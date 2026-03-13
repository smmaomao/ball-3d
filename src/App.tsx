import { Canvas, useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import { Suspense, useRef } from 'react'
import * as THREE from 'three'

const RUNWAY_WIDTH = 6
const LANE_WIDTH = RUNWAY_WIDTH / 3
const RAIL_HEIGHT = 0.8
const RAIL_WIDTH = 0.15

function LaneDashedLines() {
  const lines = []
  const dashLength = 2
  const gapLength = 2
  const segmentLength = dashLength + gapLength
  const numSegments = 30
  const linePositions = [-1, 1]

  for (let lane = 0; lane < 2; lane++) {
    const x = linePositions[lane]
    for (let i = 0; i < numSegments; i++) {
      lines.push(
        <mesh key={`line-${lane}-${i}`} position={[x, 0.02, -i * segmentLength - dashLength / 2 - 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <boxGeometry args={[0.12, dashLength, 0.02]} />
          <meshStandardMaterial color="#ffd700" metalness={0.5} roughness={0.4} />
        </mesh>
      )
    }
  }
  return <group>{lines}</group>
}

function Railing({ side }: { side: 'left' | 'right' }) {
  const x = side === 'left' ? -RUNWAY_WIDTH / 2 - RAIL_WIDTH / 2 : RUNWAY_WIDTH / 2 + RAIL_WIDTH / 2
  const postCount = 30
  const spacing = 3

  return (
    <group position={[x, 0, 0]}>
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

function Runway() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -50]} receiveShadow>
        <planeGeometry args={[RUNWAY_WIDTH, 150]} />
        <meshStandardMaterial color="#b8e6f7" metalness={0.1} roughness={0.9} />
      </mesh>
      <LaneDashedLines />
      <Railing side="left" />
      <Railing side="right" />
    </group>
  )
}

function Player() {
  const ballRef = useRef<THREE.Mesh>(null)

  return (
    <mesh ref={ballRef} position={[0, 0.4, 0]} castShadow>
      <sphereGeometry args={[0.4, 32, 32]} />
      <meshPhysicalMaterial
        color="#88d8ff"
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

function Scene() {
  return (
    <>
      <CameraSetup />
      <Lights />
      <Runway />
      <Player />
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
