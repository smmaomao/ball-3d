import { Canvas, useFrame } from '@react-three/fiber'
import { PerspectiveCamera, Text } from '@react-three/drei'
import { Suspense, useRef, useState, useCallback, useEffect, useMemo } from 'react'
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

interface Particle {
  id: number
  position: THREE.Vector3
  velocity: THREE.Vector3
  color: string
  life: number
  maxLife: number
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

function ParticleSystem({ particles }: { particles: Particle[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame(() => {
    if (!meshRef.current) return
    particles.forEach((particle, i) => {
      dummy.position.copy(particle.position)
      const scale = particle.life / particle.maxLife
      dummy.scale.setScalar(scale * 0.15)
      dummy.updateMatrix()
      meshRef.current!.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  if (particles.length === 0) return null

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, particles.length]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#ffffff" />
    </instancedMesh>
  )
}

function ScoreDisplay({ score, gameOver, speedPercent }: { score: number; gameOver: boolean; speedPercent: number }) {
  return (
    <>
      <Text
        position={[-1.5, 4.5, -2]}
        fontSize={0.6}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        得分: {score}
      </Text>
      <Text
        position={[1.5, 4.5, -2]}
        fontSize={0.6}
        color="#ffff00"
        anchorX="center"
        anchorY="middle"
      >
        速度: +{speedPercent}%
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
  const ballLightRef = useRef<THREE.PointLight>(null)
  const [lane, setLane] = useState(1)
  const colorKeys: ColorKey[] = ['red', 'green', 'blue']
  const [ballColor, setBallColor] = useState<ColorKey>(() => colorKeys[Math.floor(Math.random() * 3)])
  const [obstacles, setObstacles] = useState<Obstacle[]>([])
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [runwayOffset, setRunwayOffset] = useState(0)
  const [particles, setParticles] = useState<Particle[]>([])
  const [ballFlash, setBallFlash] = useState(0)
  const BASE_SPEED = 10
  const [speedLevel, setSpeedLevel] = useState(0)
  const [distance, setDistance] = useState(0)
  const lastObstaclesZ = useRef(-10)
  const obstacleIdCounter = useRef(0)
  const particleIdCounter = useRef(0)
  const passedObstacles = useRef<Set<number>>(new Set())
  const lastSpeedUpDistance = useRef(0)
  const lastScoreDistance = useRef(0)

  const generateObstacle = useCallback(() => {
    const lane = Math.floor(Math.random() * 3)
    const color = colorKeys[Math.floor(Math.random() * 3)]
    const z = lastObstaclesZ.current - 8 - Math.random() * 4

    lastObstaclesZ.current = z
    obstacleIdCounter.current += 1

    return {
      id: obstacleIdCounter.current,
      lane,
      z,
      color,
    }
  }, [])

  const createExplosion = useCallback((position: THREE.Vector3, color: string) => {
    const newParticles: Particle[] = []
    const particleCount = 30

    for (let i = 0; i < particleCount; i++) {
      particleIdCounter.current += 1
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      const speed = 3 + Math.random() * 4

      newParticles.push({
        id: particleIdCounter.current,
        position: position.clone(),
        velocity: new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.sin(phi) * Math.sin(theta) * speed,
          Math.cos(phi) * speed
        ),
        color,
        life: 1.0,
        maxLife: 1.0,
      })
    }

    setParticles((prev) => [...prev, ...newParticles])
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

  useFrame((_, delta) => {
    if (gameOver) return

    const currentSpeed = BASE_SPEED * (1 + speedLevel * 0.1)
    const moveDistance = currentSpeed * delta
    const newDistance = distance + moveDistance

    const displayDistance = newDistance / 2
    const lastDisplayDistance = lastSpeedUpDistance.current / 2

    if (displayDistance - lastDisplayDistance >= 10 && speedLevel < 20) {
      setSpeedLevel((prev) => prev + 1)
      lastSpeedUpDistance.current = newDistance
    }

    const scoreDelta = Math.floor(displayDistance) - Math.floor(distance / 2)
    if (scoreDelta > 0) {
      setScore((prev) => prev + scoreDelta * 10)
    }

    setDistance(newDistance)
    setRunwayOffset((prev) => prev + moveDistance)

    setParticles((prev) => {
      return prev
        .map((p) => ({
          ...p,
          position: p.position.clone().add(p.velocity.clone().multiplyScalar(delta)),
          velocity: p.velocity.clone().multiplyScalar(0.98),
          life: p.life - delta * 1.5,
        }))
        .filter((p) => p.life > 0)
    })

    if (ballFlash > 0) {
      setBallFlash((prev) => Math.max(0, prev - delta))
    }

    if (ballLightRef.current) {
      const flashIntensity = ballFlash > 0 ? 5 * Math.sin(ballFlash * Math.PI) : 0
      ballLightRef.current.intensity = flashIntensity
    }

    setObstacles((prev) => {
      let newObstacles = prev.map((obs) => ({
        ...obs,
        z: obs.z + moveDistance,
      }))

      newObstacles.forEach((obs) => {
        if (
          obs.lane === lane &&
          obs.z > -0.3 &&
          obs.z < 0.3 &&
          obs.color === ballColor &&
          !passedObstacles.current.has(obs.id)
        ) {
          passedObstacles.current.add(obs.id)
          const x = (obs.lane - 1) * LANE_WIDTH
          createExplosion(new THREE.Vector3(x, OBSTACLE_SIZE / 2, obs.z), COLORS[obs.color])
          setBallFlash(1.0)
        }
      })

      newObstacles = newObstacles.filter((obs) => {
        if (obs.lane === lane && obs.color === ballColor && obs.z > 0.5) {
          return false
        }
        return obs.z < 10
      })

      while (newObstacles.length < 15) {
        newObstacles.push(generateObstacle())
      }

      return newObstacles
    })

    const detectionRange = Math.max(0.5, moveDistance + 0.2)
    obstacles.forEach((obs) => {
      if (obs.lane === lane && obs.z > -detectionRange && obs.z < detectionRange) {
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
    setParticles([])
    setBallFlash(0)
    setSpeedLevel(0)
    setDistance(0)
    passedObstacles.current.clear()
    lastSpeedUpDistance.current = 0
    lastScoreDistance.current = 0
    lastObstaclesZ.current = -10
    obstacleIdCounter.current = 0
    const initialObstacles: Obstacle[] = []
    for (let i = 0; i < 15; i++) {
      initialObstacles.push(generateObstacle())
    }
    setObstacles(initialObstacles)
  }

  const ballEmissiveIntensity = ballFlash > 0 ? 2 * Math.sin(ballFlash * Math.PI) : 0

  return (
    <>
      <Runway offset={runwayOffset} />

      {obstacles.map((obs) => (
        <ObstacleMesh key={obs.id} obstacle={obs} />
      ))}

      <ParticleSystem particles={particles} />

      <mesh ref={ballRef} position={[0, BALL_RADIUS, 0]} castShadow>
        <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
        <meshStandardMaterial
          color={COLORS[ballColor]}
          emissive={COLORS[ballColor]}
          emissiveIntensity={ballEmissiveIntensity}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>

      <pointLight
        ref={ballLightRef}
        position={[0, BALL_RADIUS + 0.5, 0]}
        color={COLORS[ballColor]}
        intensity={0}
        distance={5}
        decay={2}
      />

      <ScoreDisplay score={score} gameOver={gameOver} speedPercent={speedLevel * 10} />

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
