"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Float,
  RoundedBox,
  Html,
  OrbitControls,
  ContactShadows,
} from "@react-three/drei";
import * as THREE from "three";

/* ── Palette ── */
const BEIGE_LIGHT = "#f0eae0";
const BEIGE_DARK = "#d4cdc4";
const BEIGE_SHADOW = "#c4bdb4";
const INK = "#1a1a1a";
const SCREEN_BG = "#2a2a2a";
const GOLD = "#c9a96e";
const GREEN_LED = "#4ade80";

/* ── Rainbow colors (classic Apple stripe order) ── */
const RAINBOW = ["#61BB46", "#FDB827", "#F5821F", "#E03A3E", "#963D97", "#009DDC"];

/* ── Fun keycap accent colors ── */
const KEY_COLORS = [
  "#e06060", "#e8a040", "#e8d44d", "#5cbf5c", "#50a0d8", "#9070c0",
  "#e87090", "#40bfbf", BEIGE_DARK,
];

/* ── YouTube video ID — replace with your own ── */
const YOUTUBE_VIDEO_ID = "C_MifNcteFM";

/* ── CRT Screen content (YouTube thumbnail with play button) ── */
function ScreenContent({ onPlay }: { onPlay?: () => void }) {
  return (
    <Html
      transform
      occlude="blending"
      distanceFactor={1.5}
      position={[0, 0.35, 0.88]}
      style={{
        width: "280px",
        height: "210px",
        background: "#1a1a2e",
        borderRadius: "4px",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      <div
        onClick={onPlay}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          cursor: "pointer",
        }}
      >
        {/* YouTube thumbnail */}
        <img
          src={`https://img.youtube.com/vi/${YOUTUBE_VIDEO_ID}/hqdefault.jpg`}
          alt="Watch video"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        {/* Play button overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: "18px solid #fff",
                borderTop: "11px solid transparent",
                borderBottom: "11px solid transparent",
                marginLeft: 4,
              }}
            />
          </div>
        </div>
      </div>
      {/* Scanlines overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 1px, transparent 1px, transparent 3px)",
          pointerEvents: "none",
          borderRadius: "4px",
        }}
      />
      {/* CRT vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "4px",
          boxShadow: "inset 0 0 30px rgba(0,0,0,0.35)",
          pointerEvents: "none",
        }}
      />
    </Html>
  );
}

/* ── Keyboard with colorful keys ── */
function Keyboard() {
  const rows = [13, 12, 12, 10];
  const keyW = 0.13;
  const keyGap = 0.018;
  const keyH = 0.035;
  const keyD = 0.11;

  /* Deterministic "random" color per key */
  const keyColor = (row: number, col: number) => {
    const idx = (row * 7 + col * 3) % KEY_COLORS.length;
    return KEY_COLORS[idx];
  };

  return (
    <group position={[0, -1.48, 1.2]} rotation={[-0.08, 0, 0]}>
      <RoundedBox args={[2.4, 0.07, 0.7]} radius={0.025} smoothness={4} position={[0, -0.02, 0]}>
        <meshStandardMaterial color={BEIGE_LIGHT} metalness={0.08} roughness={0.6} />
      </RoundedBox>
      {rows.map((keysInRow, rowIdx) => {
        const rowWidth = keysInRow * (keyW + keyGap) - keyGap;
        const startX = -rowWidth / 2 + keyW / 2;
        const z = -0.22 + rowIdx * (keyD + 0.015);
        return Array.from({ length: keysInRow }, (_, colIdx) => (
          <RoundedBox
            key={`${rowIdx}-${colIdx}`}
            args={[keyW, keyH, keyD]}
            radius={0.012}
            smoothness={2}
            position={[startX + colIdx * (keyW + keyGap), 0.035, z]}
          >
            <meshStandardMaterial
              color={keyColor(rowIdx, colIdx)}
              metalness={0.05}
              roughness={0.6}
            />
          </RoundedBox>
        ));
      })}
    </group>
  );
}

/* ── Back panel details ── */
function BackPanel() {
  return (
    <group position={[0, 0, -0.81]}>
      {/* Vent slits */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[0, 0.5 - i * 0.15, 0]}>
          <boxGeometry args={[1.0, 0.03, 0.02]} />
          <meshStandardMaterial color={BEIGE_SHADOW} metalness={0.1} roughness={0.7} />
        </mesh>
      ))}
      {/* Ports */}
      {Array.from({ length: 3 }, (_, i) => (
        <mesh key={`port-${i}`} position={[-0.3 + i * 0.3, -0.8, 0]}>
          <boxGeometry args={[0.16, 0.09, 0.02]} />
          <meshStandardMaterial color={INK} metalness={0.3} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/* ── Mouse ── */
function Mouse() {
  const cablePoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      pts.push(
        new THREE.Vector3(
          1.5 + t * 0.3 + Math.sin(t * Math.PI) * 0.15,
          -1.48,
          1.6 - t * 1.0
        )
      );
    }
    return new THREE.CatmullRomCurve3(pts);
  }, []);

  return (
    <group>
      {/* Mouse body */}
      <group position={[1.6, -1.44, 1.6]}>
        <RoundedBox args={[0.28, 0.1, 0.4]} radius={0.045} smoothness={4}>
          <meshStandardMaterial color={BEIGE_LIGHT} metalness={0.08} roughness={0.6} />
        </RoundedBox>
        {/* Mouse button */}
        <RoundedBox
          args={[0.24, 0.02, 0.18]}
          radius={0.02}
          smoothness={4}
          position={[0, 0.055, -0.05]}
        >
          <meshStandardMaterial color="#50a0d8" metalness={0.1} roughness={0.5} />
        </RoundedBox>
        {/* Button divider line */}
        <mesh position={[0, 0.065, -0.05]}>
          <boxGeometry args={[0.24, 0.004, 0.003]} />
          <meshStandardMaterial color={BEIGE_SHADOW} metalness={0.1} roughness={0.6} />
        </mesh>
      </group>
      {/* Cable */}
      <mesh>
        <tubeGeometry args={[cablePoints, 20, 0.012, 6, false]} />
        <meshStandardMaterial color={BEIGE_SHADOW} metalness={0.05} roughness={0.8} />
      </mesh>
    </group>
  );
}

/* ── Rainbow stripe (classic Apple logo style) ── */
function RainbowStripe() {
  const stripeH = 0.06;
  const totalH = RAINBOW.length * stripeH;
  const startY = totalH / 2 - stripeH / 2;

  return (
    <group position={[0.82, 0.35, 0.82]}>
      {RAINBOW.map((color, i) => (
        <mesh key={color} position={[0, startY - i * stripeH, 0]}>
          <boxGeometry args={[0.06, stripeH - 0.005, 0.01]} />
          <meshStandardMaterial color={color} metalness={0.1} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/* ── Floppy disk sticking out ── */
function FloppyDisk() {
  return (
    <group position={[0, -0.55, 0.88]} rotation={[0.03, 0, 0]}>
      {/* Disk body */}
      <RoundedBox args={[0.5, 0.04, 0.35]} radius={0.01} smoothness={2}>
        <meshStandardMaterial color="#e8d44d" metalness={0.05} roughness={0.6} />
      </RoundedBox>
      {/* Metal slider */}
      <mesh position={[0, 0.022, -0.06]}>
        <boxGeometry args={[0.25, 0.005, 0.12]} />
        <meshStandardMaterial color="#b0b0b0" metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Label */}
      <mesh position={[0, 0.022, 0.08]}>
        <boxGeometry args={[0.35, 0.004, 0.12]} />
        <meshStandardMaterial color="#fff" metalness={0.0} roughness={0.8} />
      </mesh>
    </group>
  );
}

/* ── The retro Macintosh ── */
function RetroComputer({ onScreenClick }: { onScreenClick?: () => void }) {
  const groupRef = useRef<THREE.Group>(null!);

  return (
    <Float speed={1.0} rotationIntensity={0.04} floatIntensity={0.25}>
      <group ref={groupRef} rotation={[0.05, -0.15, 0]} position={[0, 0.15, 0]} scale={0.75}>
        {/* ── Main body — deep like a real Mac ── */}
        <RoundedBox args={[2.3, 2.6, 1.6]} radius={0.06} smoothness={4}>
          <meshStandardMaterial color={BEIGE_LIGHT} metalness={0.08} roughness={0.65} />
        </RoundedBox>

        {/* ── Front face inset ── */}
        <RoundedBox args={[2.15, 2.45, 0.04]} radius={0.05} smoothness={4} position={[0, 0, 0.79]}>
          <meshStandardMaterial color={BEIGE_DARK} metalness={0.06} roughness={0.6} />
        </RoundedBox>

        {/* ── Screen bezel ── */}
        <RoundedBox args={[1.85, 1.5, 0.06]} radius={0.1} smoothness={4} position={[0, 0.35, 0.8]}>
          <meshStandardMaterial color={BEIGE_SHADOW} metalness={0.1} roughness={0.5} />
        </RoundedBox>

        {/* ── CRT screen ── */}
        <RoundedBox args={[1.65, 1.3, 0.05]} radius={0.13} smoothness={4} position={[0, 0.35, 0.83]}>
          <meshStandardMaterial
            color={SCREEN_BG}
            metalness={0.3}
            roughness={0.4}
            emissive="#1a1a2e"
            emissiveIntensity={0.4}
          />
        </RoundedBox>

        {/* ── CRT screen glow ── */}
        <pointLight
          position={[0, 0.35, 1.2]}
          color="#8090d0"
          intensity={0.15}
          distance={1.5}
        />

        {/* ── Screen content ── */}
        <ScreenContent onPlay={onScreenClick} />

        {/* ── Rainbow stripe on front ── */}
        <RainbowStripe />

        {/* ── Floppy disk sticking out ── */}
        <FloppyDisk />

        {/* ── Speaker grille (perforated rows) ── */}
        <group position={[0.65, -0.95, 0.82]}>
          {Array.from({ length: 5 }, (_, row) =>
            Array.from({ length: 4 }, (_, col) => (
              <mesh
                key={`sp-${row}-${col}`}
                position={[col * 0.06, -row * 0.06, 0]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <cylinderGeometry args={[0.018, 0.018, 0.015, 8]} />
                <meshStandardMaterial color={BEIGE_SHADOW} metalness={0.1} roughness={0.7} />
              </mesh>
            ))
          )}
        </group>

        {/* ── Power LED ── */}
        <group position={[-0.85, -0.55, 0.82]}>
          <mesh>
            <cylinderGeometry args={[0.025, 0.025, 0.012, 12]} />
            <meshStandardMaterial
              color={GREEN_LED}
              emissive={GREEN_LED}
              emissiveIntensity={1.5}
              metalness={0.3}
              roughness={0.3}
            />
          </mesh>
          {/* LED glow halo */}
          <pointLight
            position={[0, 0, 0.05]}
            color={GREEN_LED}
            intensity={0.15}
            distance={0.5}
          />
        </group>

        {/* ── Brightness knob ── */}
        <group position={[-0.85, -0.85, 0.82]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.03, 16]} />
            <meshStandardMaterial color="#e03a3e" metalness={0.15} roughness={0.5} />
          </mesh>
          {/* Knob indicator notch */}
          <mesh position={[0, 0.02, 0.016]}>
            <boxGeometry args={[0.008, 0.025, 0.005]} />
            <meshStandardMaterial color="#fff" metalness={0.2} roughness={0.5} />
          </mesh>
        </group>

        {/* ── "OPENCLAW" badge ── */}
        <group position={[-0.45, -1.05, 0.82]}>
          <RoundedBox args={[0.52, 0.2, 0.02]} radius={0.03} smoothness={4}>
            <meshStandardMaterial color="#963D97" metalness={0.15} roughness={0.6} />
          </RoundedBox>
          <Html
            transform
            occlude="blending"
            distanceFactor={1.5}
            position={[0, 0, 0.015]}
            style={{
              fontSize: "7px",
              fontFamily: "'Geist Mono', monospace",
              color: "#fff",
              fontWeight: "bold",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              userSelect: "none",
              pointerEvents: "none",
            }}
          >
            OPENCLAW
          </Html>
        </group>

        {/* ── Handle on top ── */}
        <group position={[0, 1.34, -0.1]}>
          <RoundedBox args={[0.6, 0.08, 0.4]} radius={0.035} smoothness={4}>
            <meshStandardMaterial color="#e03a3e" metalness={0.1} roughness={0.5} />
          </RoundedBox>
          {/* Handle shadow groove */}
          <mesh position={[0, -0.045, 0.15]}>
            <boxGeometry args={[0.45, 0.015, 0.08]} />
            <meshStandardMaterial color={BEIGE_SHADOW} metalness={0.05} roughness={0.7} />
          </mesh>
        </group>

        {/* ── Colorful rubber feet ── */}
        {(
          [
            [-0.85, -1.32, 0.6, "#e03a3e"],
            [0.85, -1.32, 0.6, "#61bb46"],
            [-0.85, -1.32, -0.6, "#fdb827"],
            [0.85, -1.32, -0.6, "#009ddc"],
          ] as [number, number, number, string][]
        ).map(([x, y, z, color], i) => (
          <mesh key={`foot-${i}`} position={[x, y, z]}>
            <cylinderGeometry args={[0.06, 0.07, 0.04, 12]} />
            <meshStandardMaterial color={color} metalness={0.1} roughness={0.7} />
          </mesh>
        ))}

        {/* ── Back panel ── */}
        <BackPanel />

        {/* ── Keyboard ── */}
        <Keyboard />

        {/* ── Mouse ── */}
        <Mouse />
      </group>
    </Float>
  );
}

/* ── Main exported scene ── */
export function HeroScene({ onScreenClick }: { onScreenClick?: () => void }) {
  return (
    <div className="h-[500px] w-[400px] md:h-[620px] md:w-[520px] lg:h-[700px] lg:w-[600px]">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 35 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 4, 5]} intensity={0.9} />
        <directionalLight position={[-2, 1, 3]} intensity={0.3} color={GOLD} />
        <pointLight position={[0, 2, 3]} intensity={0.3} color={GOLD} />

        <RetroComputer onScreenClick={onScreenClick} />

        <ContactShadows
          position={[0, -1.2, 0]}
          opacity={0.35}
          scale={6}
          blur={2.5}
          far={3}
          color="#8a7e72"
        />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 1.8}
          minAzimuthAngle={-Math.PI / 5}
          maxAzimuthAngle={Math.PI / 5}
          dampingFactor={0.08}
          rotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
