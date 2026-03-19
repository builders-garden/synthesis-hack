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

/* ── CRT Screen content ── */
function ScreenContent() {
  return (
    <Html
      transform
      occlude="blending"
      distanceFactor={1.5}
      position={[0, 0.35, 0.88]}
      style={{
        width: "280px",
        height: "210px",
        background: "#1e1e1e",
        borderRadius: "4px",
        overflow: "hidden",
        fontFamily: "'Geist Mono', 'Monaco', monospace",
        fontSize: "11px",
        color: "#e0ddd6",
        userSelect: "none",
        pointerEvents: "none",
      }}
    >
      <div style={{ padding: "10px 12px", height: "100%" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
            opacity: 0.5,
            fontSize: "10px",
            letterSpacing: "0.05em",
          }}
        >
          <span>YieldOS 1.0</span>
          <span style={{ fontFamily: "monospace" }}>■ ■ ■</span>
        </div>
        <div style={{ display: "flex", gap: "12px", height: "calc(100% - 28px)" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontSize: "10px",
              minWidth: "70px",
            }}
          >
            {[
              { icon: "◆", label: "System", color: "#6b9bd2" },
              { icon: "◆", label: "Wallet", color: "#c9a96e" },
              { icon: "◆", label: "Staking", color: "#7aba7a" },
              { icon: "◆", label: "Agent", color: "#e0ddd6" },
              { icon: "◆", label: "Logs", color: "#9c958e" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ color: item.color, fontSize: "6px" }}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <div
            style={{
              flex: 1,
              background: "#f0eae0",
              color: "#1a1a1a",
              borderRadius: "2px",
              padding: "8px",
              fontSize: "10px",
              lineHeight: "1.5",
              fontFamily: "'Geist Mono', 'Monaco', monospace",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderBottom: "1px dashed #9c958e",
                paddingBottom: "4px",
                marginBottom: "6px",
                fontSize: "9px",
                fontWeight: "bold",
              }}
            >
              <span>agent.log</span>
              <span>[x]</span>
            </div>
            <div style={{ opacity: 0.85 }}>
              <span style={{ color: "#6b9bd2" }}>{">"}</span> Yield accrued: 0.003 stETH
              <br />
              <span style={{ color: "#7aba7a" }}>{">"}</span> Swapped → 5.12 USDC
              <br />
              <span style={{ color: "#c9a96e" }}>{">"}</span> Inference paid. Thinking...
              <br />
              <span style={{ color: "#e0ddd6" }}>{">"}</span> Task complete.
              <br />
              <span style={{ color: "#9c958e" }}>{">"}</span> Ready when you are.
              <br />
              <span
                style={{
                  display: "inline-block",
                  width: "6px",
                  height: "11px",
                  background: "#c9a96e",
                  animation: "blink 1s step-end infinite",
                  verticalAlign: "text-bottom",
                  marginLeft: "2px",
                }}
              />
            </div>
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
      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
    </Html>
  );
}

/* ── Keyboard ── */
function Keyboard() {
  const rows = [13, 12, 12, 10];
  const keyW = 0.13;
  const keyGap = 0.018;
  const keyH = 0.035;
  const keyD = 0.11;

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
            <meshStandardMaterial color={BEIGE_DARK} metalness={0.05} roughness={0.7} />
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
          <meshStandardMaterial color={BEIGE_DARK} metalness={0.06} roughness={0.65} />
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

/* ── The retro Macintosh ── */
function RetroComputer() {
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
            emissive="#1a2a1a"
            emissiveIntensity={0.3}
          />
        </RoundedBox>

        {/* ── CRT screen glow ── */}
        <pointLight
          position={[0, 0.35, 1.2]}
          color="#a0c8a0"
          intensity={0.12}
          distance={1.5}
        />

        {/* ── Screen content ── */}
        <ScreenContent />

        {/* ── Floppy slot — with depth ── */}
        <group position={[0, -0.55, 0.8]}>
          {/* Outer slot frame */}
          <mesh position={[0, 0, 0.025]}>
            <boxGeometry args={[0.7, 0.07, 0.01]} />
            <meshStandardMaterial color={BEIGE_SHADOW} metalness={0.1} roughness={0.6} />
          </mesh>
          {/* Inner dark slot */}
          <mesh position={[0, 0, 0.02]}>
            <boxGeometry args={[0.6, 0.035, 0.01]} />
            <meshStandardMaterial color="#2a2a2a" metalness={0.4} roughness={0.5} />
          </mesh>
        </group>

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
            <meshStandardMaterial color={BEIGE_SHADOW} metalness={0.15} roughness={0.5} />
          </mesh>
          {/* Knob indicator notch */}
          <mesh position={[0, 0.02, 0.016]}>
            <boxGeometry args={[0.008, 0.025, 0.005]} />
            <meshStandardMaterial color={INK} metalness={0.2} roughness={0.5} />
          </mesh>
        </group>

        {/* ── "YIELD AGENT" badge ── */}
        <group position={[-0.45, -1.05, 0.82]}>
          <RoundedBox args={[0.48, 0.2, 0.02]} radius={0.03} smoothness={4}>
            <meshStandardMaterial color="#8B2020" metalness={0.15} roughness={0.7} />
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
            YIELD AGENT
          </Html>
        </group>

        {/* ── Handle on top ── */}
        <group position={[0, 1.34, -0.1]}>
          <RoundedBox args={[0.6, 0.08, 0.4]} radius={0.035} smoothness={4}>
            <meshStandardMaterial color={BEIGE_DARK} metalness={0.1} roughness={0.6} />
          </RoundedBox>
          {/* Handle shadow groove */}
          <mesh position={[0, -0.045, 0.15]}>
            <boxGeometry args={[0.45, 0.015, 0.08]} />
            <meshStandardMaterial color={BEIGE_SHADOW} metalness={0.05} roughness={0.7} />
          </mesh>
        </group>

        {/* ── Rubber feet ── */}
        {[
          [-0.85, -1.32, 0.6],
          [0.85, -1.32, 0.6],
          [-0.85, -1.32, -0.6],
          [0.85, -1.32, -0.6],
        ].map((pos, i) => (
          <mesh key={`foot-${i}`} position={pos as [number, number, number]}>
            <cylinderGeometry args={[0.06, 0.07, 0.04, 12]} />
            <meshStandardMaterial color="#3a3a3a" metalness={0.1} roughness={0.9} />
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
export function HeroScene() {
  return (
    <div className="h-[420px] w-[320px] md:h-[520px] md:w-[420px] lg:h-[580px] lg:w-[480px]">
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 35 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 4, 5]} intensity={0.9} />
        <directionalLight position={[-2, 1, 3]} intensity={0.3} color={GOLD} />
        <pointLight position={[0, 2, 3]} intensity={0.3} color={GOLD} />

        <RetroComputer />

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
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.6}
          dampingFactor={0.08}
          rotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
