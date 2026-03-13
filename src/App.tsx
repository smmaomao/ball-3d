import { Canvas, useFrame } from '@react-three/fiber'
import { PerspectiveCamera, Text } from '@react-three/drei'
import { Suspense, useRef, useState, useCallback, useEffect } from 'react'
import * as THREE from 'three'

const RUNWAY_WIDTH = 6
const LANE_WIDTH = RUNWAY_WIDTH / 3
const RAIL_HEIGHT = 0.8
const RAIL_WIDTH = 0.15
const BALL_RADIUS = 0.4
const OBSTACLE_SIZE = 0.8

const COLORS = {
  red: '#ff4444',
  green: '#44ff44',
  blue: '#4444ff',
} as const

type ColorKey = keyof typeof COLORS

interface Obstacle {
  id: number
  lane: number
  z: number
  color: ColorKey
}

function LaneDashedLines({ offset }: { offset: number }) {
  const lines = []
  const dashLength = 2
  const gapLength = 2
  const segmentLength = dashLength + gapLength
  const numSegments = 40
  const linePositions = [-1, 1]

  for (let lane = 0; lane < 2; lane++) {
    const x = linePositions[lane]
    for (let i = 0; i < numSegments; i++) {
      const z = -i * segmentLength - dashLength / 2 - 2 + (offset % segmentLength)
      lines.push(
        <mesh key={`line-${lane}-${i}`} position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <boxGeometry args={[0.12, dashLength, 0.02]} />
          <meshStandardMaterial color="#ffd700" metalness={0.5} roughness={0.4} />
        </mesh>
      )
    }
  }
  return <group>{lines}</group>
}

function Railing({ side, offset }: { side: 'left' | 'right'; offset: number }) {
  const x = side === 'left' ? -RUNWAY_WIDTH / 2 - RAIL_WIDTH / 2 : RUNWAY_WIDTH / 2 + RAIL_WIDTH / 2
  const postCount = 30
  const spacing = 3
  const zOffset = offset % spacing

  return (
    <group position={[x, 0, zOffset]}>
      <mesh position={[0, RAIL_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[RAIL_WIDTH, RAIL_HEIGHT, postCount * spacing]} />
        <meshStandardMaterial color="#ffd700" metalness={0.6} roughness={0.3} />
      </mesh>
      {Array.from({ length: postCount }).map((_, i) => (
        <mesh key={i} position={[0, RAIL_HEIGHT, -i * spacing]} castShadow>
          <boxGeometry args={[RAIL_WIDTH * 1.2, RAIL_WIDTH * 1.2, RAIL_WIDTH * 1.2]} />
          <meshStandardMaterial color="#ffd700" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

function Runway({ offset }: { offset: number }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -50]} receiveShadow>
        <planeGeometry args={[RUNWAY_WIDTH, 150]} />
        <meshStandardMaterial color="#b8e6f7" metalness={0.1} roughness={0.9} />
      </mesh>
      <LaneDashedLines offset={offset} />
      <Railing side="left" offset={offset} />
      <Railing side="right" offset={offset} />
    </group>
  )
}

function ObstacleMesh({ obstacle }: { obstacle: Obstacle }) {
  const x = (obstacle.lane - 1) * LANE_WIDTH
  return (
    <mesh position={[x, OBSTACLE_SIZE / 2, obstacle.z]} castShadow>
      <boxGeometry args={[OBSTACLE_SIZE, OBSTACLE_SIZE, OBSTACLE_SIZE]} />
      <meshStandardMaterial color={COLORS[obstacle.color]} metalness={0.3} roughness={0.4} />
    </mesh>
  )
}

function ScoreDisplay({ score, gameOver }: { score: number; gameOver: boolean }) {
  return (
    <>
      <Text
        position={[0, 4, -2]}
        fontSize={0.8}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        得分: {score}
      </Text>
      {gameOver && (
        <Text
          position={[0, 3, -2]}
          fontSize={1.2}
          color="#ff4444"
          anchorX="center"
          anchorY="middle"
        >
          游戏结束!
        </Text>
      )}
    </>
  )
}

function Game() {
  const ballRef = useRef<THREE.Mesh>(null)
  const [lane, setLane] = useState(1)
  const colorKeys: ColorKey[] = ['red', 'green', 'blue']
  const [ballColor, setBallColor] = useState<ColorKey>(() => colorKeys[Math.floor(Math.random() * 3)])
  const [obstacles, setObstacles] = useState<Obstacle[]>([])
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [runwayOffset, setRunwayOffset] = useState(0)
  const lastObstacleZ = useRef(-10)
  const obstacleIdCounter = useRef(0)
  const lastScoreTime = useRef(0)

  const generateObstacle = useCallback(() => {
    const lane = Math.floor(Math.random() * 3)
    const color = colorKeys[Math.floor(Math.random() * 3)]
    const z = lastObstacleZ.current - 8 - Math.random() * 4

    lastObstacleZ.current = z
    obstacleIdCounter.current += 1

    return {
      id: obstacleIdCounter.current,
      lane,
      z,
      color,
    }
  }, [])

  useEffect(() => {
    const initialObstacles: Obstacle[] = []
    for (let i = 0; i < 15; i++) {
      initialObstacles.push(generateObstacle())
    }
    setObstacles(initialObstacles)
  }, [generateObstacle])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver) return

      if (e.key === 'ArrowLeft') {
        setLane((prev) => Math.max(0, prev - 1))
      } else if (e.key === 'ArrowRight') {
        setLane((prev) => Math.min(2, prev + 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gameOver])

  useFrame((state, delta) => {
    if (gameOver) return

    const speed = 10
    const moveDistance = speed * delta

    setRunwayOffset((prev) => prev + moveDistance)

    setObstacles((prev) => {
      let newObstacles = prev.map((obs) => ({
        ...obs,
        z: obs.z + moveDistance,
      }))

      newObstacles = newObstacles.filter((obs) => obs.z < 10)

      while (newObstacles.length < 15) {
        newObstacles.push(generateObstacle())
      }

      return newObstacles
    })

    const now = state.clock.elapsedTime
    if (now - lastScoreTime.current >= 1) {
      setScore((prev) => prev + 10)
      lastScoreTime.current = now
    }

    obstacles.forEach((obs) => {
      if (obs.lane === lane && obs.z > -0.5 && obs.z < 0.5) {
        if (obs.color !== ballColor) {
          setGameOver(true)
        }
      }
    })

    if (ballRef.current) {
      const targetX = (lane - 1) * LANE_WIDTH
      ballRef.current.position.x = THREE.MathUtils.lerp(ballRef.current.position.x, targetX, 0.2)
      ballRef.current.rotation.x -= moveDistance * 2
    }
  })

  const restartGame = () => {
    setLane(1)
    setBallColor(colorKeys[Math.floor(Math.random() * 3)])
    setScore(0)
    setGameOver(false)
    setRunwayOffset(0)
    lastObstacleZ.current = -10
    obstacleIdCounter.current = 0
    lastScoreTime.current = 0
    const initialObstacles: Obstacle[] = []
    for (let i = 0; i < 15; i++) {
      initialObstacles.push(generateObstacle())
    }
    setObstacles(initialObstacles)
  }

  return (
    <>
      <Runway offset={runwayOffset} />

      {obstacles.map((obs) => (
        <ObstacleMesh key={obs.id} obstacle={obs} />
      ))}

      <mesh ref={ballRef} position={[0, BALL_RADIUS, 0]} castShadow>
        <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
        <meshPhysicalMaterial
          color={COLORS[ballColor]}
          metalness={0.1}
          roughness={0.05}
          transmission={0.9}
          thickness={0.5}
          ior={1.5}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>

      <ScoreDisplay score={score} gameOver={gameOver} />

      {gameOver && (
        <group position={[0, 2, -2]}>
          <mesh
            onClick={restartGame}
            onPointerOver={(e) => (e.object.scale.setScalar(1.1))}
            onPointerOut={(e) => (e.object.scale.setScalar(1))}
          >
            <boxGeometry args={[3, 0.8, 0.2]} />
            <meshStandardMaterial color="#44ff44" />
          </mesh>
          <Text
            position={[0, 0, 0.15]}
            fontSize={0.4}
            color="white"
            anchorX="center"
            anchorY="middle"
          >
            重新开始
          </Text>
        </group>
      )}
    </>
  )
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[5, 15, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <pointLight position={[0, 3, -5]} intensity={0.5} color="#ffffff" />
    </>
  )
}

function CameraSetup() {
  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[0, 8, 6]}
        fov={60}
        rotation={[-Math.PI / 6, 0, 0]}
      />
    </>
  )
}

function Scene() {
  return (
    <>
      <CameraSetup />
      <Lights />
      <Game />
      <fog attach="fog" args={['#1a1a2e', 15, 60]} />
    </>
  )
}

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas shadows>
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  )
}
