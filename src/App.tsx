import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, Html } from '@react-three/drei'
import { Suspense, useRef, useState, useEffect, useMemo } from 'react'
import * as THREE from 'three'

const RUNWAY_WIDTH = 6
const RAIL_HEIGHT = 0.8
const RAIL_WIDTH = 0.15
const GAME_SPEED = 15
const COLORS = ['#ff4444', '#44ff44', '#4444ff']

interface Obstacle {
  id: number
  lane: number
  z: number
  colorIndex: number
  passed: boolean
}

function LaneDashedLines() {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.position.z += GAME_SPEED * delta
      if (groupRef.current.position.z > 4) {
        groupRef.current.position.z = 0
      }
    }
  })

  const lines = useMemo(() => {
    const temp = []
    const dashLength = 2
    const gapLength = 2
    const segmentLength = dashLength + gapLength
    const numSegments = 40
    const linePositions = [-1, 1]

    for (let lane = 0; lane < 2; lane++) {
      const x = linePositions[lane]
      for (let i = 0; i < numSegments; i++) {
        temp.push(
          <mesh key={`line-${lane}-${i}`} position={[x, 0.02, -i * segmentLength - dashLength / 2]} rotation={[-Math.PI / 2, 0, 0]}>
            <boxGeometry args={[0.12, dashLength, 0.02]} />
            <meshStandardMaterial color="#ffd700" metalness={0.5} roughness={0.4} />
          </mesh>
        )
      }
    }
    return temp
  }, [])

  return <group ref={groupRef}>{lines}</group>
}

function Railing({ side }: { side: 'left' | 'right' }) {
  const groupRef = useRef<THREE.Group>(null)
  const x = side === 'left' ? -RUNWAY_WIDTH / 2 - RAIL_WIDTH / 2 : RUNWAY_WIDTH / 2 + RAIL_WIDTH / 2
  const segmentLength = 12
  const numSegments = 12

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.position.z += GAME_SPEED * delta
      if (groupRef.current.position.z > segmentLength) {
        groupRef.current.position.z = 0
      }
    }
  })

  const posts = useMemo(() => {
    return Array.from({ length: numSegments }).map((_, i) => (
      <mesh key={i} position={[0, RAIL_HEIGHT, -i * 3]} castShadow>
        <boxGeometry args={[RAIL_WIDTH * 1.2, RAIL_WIDTH * 1.2, RAIL_WIDTH * 1.2]} />
        <meshStandardMaterial color="#ffd700" metalness={0.6} roughness={0.3} />
      </mesh>
    ))
  }, [])

  return (
    <group position={[x, 0, 0]}>
      <group ref={groupRef}>
        <mesh position={[0, RAIL_HEIGHT / 2, -numSegments * 1.5]} castShadow>
          <boxGeometry args={[RAIL_WIDTH, RAIL_HEIGHT, numSegments * 3]} />
          <meshStandardMaterial color="#ffd700" metalness={0.6} roughness={0.3} />
        </mesh>
        {posts}
      </group>
    </group>
  )
}

function Runway() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[RUNWAY_WIDTH, 500]} />
        <meshStandardMaterial color="#b8e6f7" metalness={0.1} roughness={0.9} />
      </mesh>
      <LaneDashedLines />
      <Railing side="left" />
      <Railing side="right" />
    </group>
  )
}

function Obstacles({ obstacles }: { obstacles: Obstacle[] }) {
  return (
    <group>
      {obstacles.map((obs) => (
        <mesh key={obs.id} position={[obs.lane * 2 - 2, 0.75, obs.z]} castShadow>
          <boxGeometry args={[1.5, 1.5, 1.5]} />
          <meshStandardMaterial color={COLORS[obs.colorIndex]} />
        </mesh>
      ))}
    </group>
  )
}

function Player({ 
  gameState, 
  lane,
  setLane,
  obstacles, 
  ballColorIndex,
  setGameState
}: { 
  gameState: 'playing' | 'gameOver',
  lane: number,
  setLane: React.Dispatch<React.SetStateAction<number>>,
  obstacles: Obstacle[],
  ballColorIndex: number,
  setGameState: (state: 'playing' | 'gameOver') => void
}) {
  const ballRef = useRef<THREE.Mesh>(null)
  const targetX = useRef(0)
  const currentX = useRef(0)

  useFrame((_, delta) => {
    targetX.current = (lane - 1) * 2
    currentX.current = THREE.MathUtils.lerp(currentX.current, targetX.current, delta * 10)
    
    if (ballRef.current) {
      ballRef.current.position.x = currentX.current
      if (gameState === 'playing') {
        ballRef.current.rotation.x += delta * GAME_SPEED / 2
      }
    }

    if (gameState === 'playing') {
      obstacles.forEach((obs) => {
        if (!obs.passed && obs.z > -1 && obs.z < 1) {
          if (obs.lane === lane) {
            if (obs.colorIndex !== ballColorIndex) {
              setGameState('gameOver')
            } else {
              obs.passed = true
            }
          }
        }
      })
    }
  })

  return (
    <mesh ref={ballRef} position={[0, 0.4, 0]} castShadow>
      <sphereGeometry args={[0.4, 32, 32]} />
      <meshPhysicalMaterial
        color={COLORS[ballColorIndex]}
        metalness={0.1}
        roughness={0.05}
        transmission={0.9}
        thickness={0.5}
        ior={1.5}
        clearcoat={1}
        clearcoatRoughness={0.1}
      />
    </mesh>
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

function GameUI({ score, gameState }: { score: number, gameState: 'playing' | 'gameOver' }) {
  const { size } = useThree()
  const scale = Math.min(size.width / 1920, 1)

  return (
    <Html fullscreen>
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'white',
        fontSize: `${32 * Math.max(scale, 0.5)}px`,
        fontWeight: 'bold',
        fontFamily: 'Arial, sans-serif',
        textShadow: '2px 2px 4px black',
        whiteSpace: 'nowrap',
        textAlign: 'center',
        width: 'auto'
      }}>
        分数: {score}
      </div>
      {gameState === 'gameOver' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          fontSize: `${48 * Math.max(scale, 0.5)}px`,
          fontWeight: 'bold',
          fontFamily: 'Arial, sans-serif',
          textAlign: 'center',
          textShadow: '2px 2px 4px black',
          whiteSpace: 'nowrap',
          width: 'auto'
        }}>
          <div style={{ marginBottom: '20px' }}>游戏失败!</div>
          <div style={{ fontSize: `${24 * Math.max(scale, 0.5)}px` }}>按空格键重新开始</div>
        </div>
      )}
    </Html>
  )
}

function Scene() {
  const [gameState, setGameState] = useState<'playing' | 'gameOver'>('playing')
  const [obstacles, setObstacles] = useState<Obstacle[]>([])
  const [ballColorIndex, setBallColorIndex] = useState(Math.floor(Math.random() * 3))
  const [score, setScore] = useState(0)
  const [lane, setLane] = useState(1)
  const obstacleIdRef = useRef(0)

  const restartGame = () => {
    setGameState('playing')
    setObstacles([])
    setScore(0)
    setLane(1)
    setBallColorIndex(Math.floor(Math.random() * 3))
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && gameState === 'gameOver') {
        e.preventDefault()
        restartGame()
      }
      if (gameState === 'playing') {
        if (e.key === 'ArrowLeft') {
          setLane(prev => Math.max(0, prev - 1))
        } else if (e.key === 'ArrowRight') {
          setLane(prev => Math.min(2, prev + 1))
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gameState])

  useEffect(() => {
    const interval = setInterval(() => {
      if (gameState === 'playing') {
        setScore(s => s + 10)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [gameState])

  useFrame((_, delta) => {
    if (gameState !== 'playing') return

    setObstacles(prev => 
      prev.map(obs => ({ ...obs, z: obs.z + GAME_SPEED * delta }))
          .filter(obs => obs.z < 30)
    )

    if (Math.random() < 0.02) {
      const lane = Math.floor(Math.random() * 3)
      const colorIndex = Math.floor(Math.random() * 3)
      setObstacles(prev => [...prev, {
        id: obstacleIdRef.current++,
        lane,
        z: -100,
        colorIndex,
        passed: false
      }])
    }
  })

  return (
    <>
      <CameraSetup />
      <Lights />
      <Runway />
      <Obstacles obstacles={obstacles} />
      <Player 
        gameState={gameState} 
        lane={lane}
        setLane={setLane}
        obstacles={obstacles}
        ballColorIndex={ballColorIndex}
        setGameState={setGameState}
      />
      <GameUI score={score} gameState={gameState} />
      <fog attach="fog" args={['#1a1a2e', 15, 60]} />
    </>
  )
}

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Canvas shadows>
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  )
}
