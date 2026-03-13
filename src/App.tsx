import { Canvas, useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import { Suspense, useRef, useState, useEffect, useCallback, useMemo } from 'react'
import * as THREE from 'three'

const RUNWAY_WIDTH = 6
const LANE_WIDTH = RUNWAY_WIDTH / 3
const RAIL_HEIGHT = 0.8
const RAIL_WIDTH = 0.15
const BALL_RADIUS = 0.4
const RUNWAY_LENGTH = 150

const COLORS = ['#ff6b6b', '#4ecdc4', '#ffe66d']
const COLOR_NAMES = ['红色', '青色', '黄色']

type LanePosition = -1 | 0 | 1
type GameState = 'playing' | 'gameover'

interface Obstacle {
  id: number
  lane: LanePosition
  colorIndex: number
  z: number
}

function getLaneX(lane: LanePosition): number {
  return lane * LANE_WIDTH
}

function MovingLaneLines({ speed, gameState }: { speed: number; gameState: GameState }) {
  const groupRef = useRef<THREE.Group>(null)
  const offsetRef = useRef(0)
  
  const dashLength = 2
  const gapLength = 2
  const segmentLength = dashLength + gapLength
  const linePositions = [-1, 1]

  useFrame((_, delta) => {
    if (gameState === 'playing' && groupRef.current) {
      offsetRef.current += speed * delta
      if (offsetRef.current >= segmentLength) {
        offsetRef.current = offsetRef.current % segmentLength
      }
      groupRef.current.position.z = offsetRef.current
    }
  })

  const lines = useMemo(() => {
    const result = []
    const numSegments = 40
    for (let lane = 0; lane < 2; lane++) {
      const x = linePositions[lane]
      for (let i = 0; i < numSegments; i++) {
        result.push(
          <mesh key={`line-${lane}-${i}`} position={[x, 0.02, -i * segmentLength - dashLength / 2 - 2]} rotation={[-Math.PI / 2, 0, 0]}>
            <boxGeometry args={[0.12, dashLength, 0.02]} />
            <meshStandardMaterial color="#ffd700" metalness={0.5} roughness={0.4} />
          </mesh>
        )
      }
    }
    return result
  }, [])

  return <group ref={groupRef}>{lines}</group>
}

function MovingRailing({ side, speed, gameState }: { side: 'left' | 'right'; speed: number; gameState: GameState }) {
  const groupRef = useRef<THREE.Group>(null)
  const offsetRef = useRef(0)
  const spacing = 3
  
  const x = side === 'left' ? -RUNWAY_WIDTH / 2 - RAIL_WIDTH / 2 : RUNWAY_WIDTH / 2 + RAIL_WIDTH / 2
  const postCount = 40

  useFrame((_, delta) => {
    if (gameState === 'playing' && groupRef.current) {
      offsetRef.current += speed * delta
      if (offsetRef.current >= spacing) {
        offsetRef.current = offsetRef.current % spacing
      }
      groupRef.current.position.z = offsetRef.current
    }
  })

  return (
    <group position={[x, 0, 0]}>
      <group ref={groupRef}>
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
    </group>
  )
}

function Runway({ speed, gameState }: { speed: number; gameState: GameState }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -50]} receiveShadow>
        <planeGeometry args={[RUNWAY_WIDTH, RUNWAY_LENGTH]} />
        <meshStandardMaterial color="#b8e6f7" metalness={0.1} roughness={0.9} />
      </mesh>
      <MovingLaneLines speed={speed} gameState={gameState} />
      <MovingRailing side="left" speed={speed} gameState={gameState} />
      <MovingRailing side="right" speed={speed} gameState={gameState} />
    </group>
  )
}

function Player({ lane, colorIndex }: { lane: LanePosition; colorIndex: number }) {
  const ballRef = useRef<THREE.Mesh>(null)
  const targetX = getLaneX(lane)
  const currentX = useRef(targetX)

  useFrame((_, delta) => {
    if (ballRef.current) {
      currentX.current = THREE.MathUtils.lerp(currentX.current, targetX, 10 * delta)
      ballRef.current.position.x = currentX.current
      ballRef.current.rotation.x -= delta * 5
    }
  })

  return (
    <mesh ref={ballRef} position={[0, BALL_RADIUS, 0]} castShadow>
      <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
      <meshPhysicalMaterial
        color={COLORS[colorIndex]}
        metalness={0.1}
        roughness={0.05}
        transmission={0.6}
        thickness={0.5}
        ior={1.5}
        clearcoat={1}
        clearcoatRoughness={0.1}
      />
    </mesh>
  )
}

function ObstacleMesh({ obstacle }: { obstacle: Obstacle }) {
  const x = getLaneX(obstacle.lane)
  
  return (
    <group position={[x, 0.6, obstacle.z]}>
      <mesh castShadow>
        <boxGeometry args={[LANE_WIDTH * 0.8, 1.2, 0.5]} />
        <meshStandardMaterial 
          color={COLORS[obstacle.colorIndex]} 
          metalness={0.3} 
          roughness={0.4}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
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
    <PerspectiveCamera
      makeDefault
      position={[0, 8, 6]}
      fov={60}
      rotation={[-Math.PI / 6, 0, 0]}
    />
  )
}

function GameUI({ score, colorIndex, gameState, onRestart }: { 
  score: number
  colorIndex: number
  gameState: GameState
  onRestart: () => void
}) {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: gameState === 'gameover' ? 'auto' : 'none',
      zIndex: 10
    }}>
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        color: '#fff',
        fontSize: 24,
        fontFamily: 'Arial, sans-serif',
        textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
      }}>
        <div>分数: {score}</div>
        <div style={{ fontSize: 18, marginTop: 10 }}>
          球色: <span style={{ color: COLORS[colorIndex] }}>{COLOR_NAMES[colorIndex]}</span>
        </div>
      </div>
      
      <div style={{
        position: 'absolute',
        top: 20,
        right: 20,
        color: '#fff',
        fontSize: 16,
        fontFamily: 'Arial, sans-serif',
        textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
        textAlign: 'right'
      }}>
        <div>← → 方向键移动</div>
        <div>同色障碍可通过</div>
      </div>
      
      {gameState === 'gameover' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: '#fff',
          fontFamily: 'Arial, sans-serif'
        }}>
          <div style={{ fontSize: 48, textShadow: '3px 3px 6px rgba(0,0,0,0.8)' }}>
            游戏结束
          </div>
          <div style={{ fontSize: 32, marginTop: 20, textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
            最终分数: {score}
          </div>
          <button
            onClick={onRestart}
            style={{
              marginTop: 30,
              padding: '15px 40px',
              fontSize: 20,
              cursor: 'pointer',
              backgroundColor: COLORS[colorIndex],
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              fontWeight: 'bold',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
              transition: 'transform 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            重新开始
          </button>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [lane, setLane] = useState<LanePosition>(0)
  const [colorIndex, setColorIndex] = useState(() => Math.floor(Math.random() * 3))
  const [score, setScore] = useState(0)
  const [gameState, setGameState] = useState<GameState>('playing')
  const speedRef = useRef(8)
  const [, forceUpdate] = useState(0)

  const restartGame = useCallback(() => {
    setLane(0)
    setColorIndex(Math.floor(Math.random() * 3))
    setScore(0)
    setGameState('playing')
    speedRef.current = 8
  }, [])

  useEffect(() => {
    if (gameState !== 'playing') return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setLane((prev) => (prev > -1 ? (prev - 1) as LanePosition : prev))
      } else if (e.key === 'ArrowRight') {
        setLane((prev) => (prev < 1 ? (prev + 1) as LanePosition : prev))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gameState])

  useEffect(() => {
    if (gameState !== 'playing') return

    const scoreInterval = setInterval(() => {
      setScore((prev) => prev + 10)
      speedRef.current = Math.min(speedRef.current + 0.05, 20)
    }, 1000)

    return () => clearInterval(scoreInterval)
  }, [gameState])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Canvas shadows>
        <Suspense fallback={null}>
          <GameScene 
            lane={lane} 
            colorIndex={colorIndex} 
            speed={speedRef.current}
            gameState={gameState}
            onGameOver={() => setGameState('gameover')}
          />
        </Suspense>
      </Canvas>
      <GameUI 
        score={score} 
        colorIndex={colorIndex}
        gameState={gameState}
        onRestart={restartGame}
      />
    </div>
  )
}

function GameScene({ 
  lane, 
  colorIndex, 
  speed,
  gameState,
  onGameOver
}: { 
  lane: LanePosition
  colorIndex: number
  speed: number
  gameState: GameState
  onGameOver: () => void
}) {
  const obstaclesRef = useRef<Obstacle[]>([])
  const lastObstacleZRef = useRef(-15)
  const obstacleIdRef = useRef(0)
  const [, setTick] = useState(0)

  useFrame((_, delta) => {
    if (gameState !== 'playing') return

    obstaclesRef.current = obstaclesRef.current
      .map(obs => ({ ...obs, z: obs.z + speed * delta }))
      .filter(obs => obs.z < 15)

    const lastZ = obstaclesRef.current.length > 0 
      ? Math.min(...obstaclesRef.current.map(o => o.z))
      : lastObstacleZRef.current

    const nextDistance = 10 + Math.random() * 8
    if (lastZ > -nextDistance) {
      const newZ = lastZ - nextDistance
      
      const numLanes = Math.floor(Math.random() * 3) + 1
      const availableLanes: LanePosition[] = [-1, 0, 1]
      const selectedLanes: LanePosition[] = []
      
      for (let i = 0; i < numLanes && availableLanes.length > 0; i++) {
        const idx = Math.floor(Math.random() * availableLanes.length)
        selectedLanes.push(availableLanes.splice(idx, 1)[0])
      }
      
      const newObstacles: Obstacle[] = selectedLanes.map((lanePos) => ({
        id: obstacleIdRef.current++,
        lane: lanePos,
        colorIndex: Math.floor(Math.random() * 3),
        z: newZ
      }))
      
      obstaclesRef.current = [...obstaclesRef.current, ...newObstacles]
      lastObstacleZRef.current = newZ
    }

    for (const obs of obstaclesRef.current) {
      if (obs.z > -0.5 && obs.z < 0.5 && obs.lane === lane) {
        if (obs.colorIndex !== colorIndex) {
          onGameOver()
          break
        }
      }
    }

    setTick(t => t + 1)
  })

  return (
    <>
      <CameraSetup />
      <Lights />
      <Runway speed={speed} gameState={gameState} />
      <Player lane={lane} colorIndex={colorIndex} />
      <group>
        {obstaclesRef.current.map((obstacle) => (
          <ObstacleMesh key={obstacle.id} obstacle={obstacle} />
        ))}
      </group>
      <fog attach="fog" args={['#1a1a2e', 15, 60]} />
    </>
  )
}
