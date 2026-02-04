'use client';

import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei'; // 1. Import Text

export default function Experience() {
  const meshRef = useRef();
  const [hovered, setHover] = useState(false);

  // Audio setup (kept from previous step)
  const hoverSound = useMemo(() => {
    if (typeof window !== 'undefined') {
      return new Audio('/hover.mp3'); 
    }
    return null;
  }, []);

  useFrame((state, delta) => {
    if (meshRef.current) {
      // Rotate the fire slightly
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <Text
      ref={meshRef}
      onPointerOver={() => {
        setHover(true);
        if (hoverSound) {
          hoverSound.currentTime = 0;
          hoverSound.play().catch((e) => console.log(e));
        }
      }}
      onPointerOut={() => setHover(false)}
      
      // 2. Animation Props
      scale={hovered ? 1.5 : 1}   // Scales up 1.5x on hover
      color={hovered ? "#ff0000" : "#ff4500"} // Changes color from orange-red to red
      anchorX="center" 
      anchorY="middle"
      fontSize={2}
    >
      🔥
    </Text>
  );
}