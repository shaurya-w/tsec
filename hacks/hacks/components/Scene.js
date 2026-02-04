'use client';

import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import Experience from './Experience';

export default function Scene() {
  return (
    // The parent div must have a defined height for the Canvas to show up
    <div className="w-full h-screen relative bg-gray-950">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true }}
      >
        {/* Lights */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        
        {/* Controls to move around during dev */}
        <OrbitControls makeDefault />

        {/* Your actual 3D content */}
        <Experience />

        {/* Environment for realistic reflections (optional but nice) */}
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}