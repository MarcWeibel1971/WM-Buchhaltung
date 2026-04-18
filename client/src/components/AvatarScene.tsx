import { useRef, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, VRMHumanBoneName } from "@pixiv/three-vrm";
import type { VRM } from "@pixiv/three-vrm";

// ─── WebGL Detection ──────────────────────────────────────────────────────────

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

// ─── VRM Avatar Component ────────────────────────────────────────────────────

interface VRMAvatarProps {
  vrmUrl: string;
  isSpeaking: boolean;
  audioAnalyser: AnalyserNode | null;
  onLoaded: () => void;
  onError: () => void;
}

function VRMAvatar({ vrmUrl, isSpeaking, audioAnalyser, onLoaded, onError }: VRMAvatarProps) {
  const vrmRef = useRef<VRM | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const blinkTimerRef = useRef(0);
  const nextBlinkRef = useRef(3);
  const mouthOpenRef = useRef(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const freqDataRef = useRef<any>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      vrmUrl,
      (gltf) => {
        const vrm = gltf.userData.vrm as VRM;
        if (!vrm) {
          console.error("VRM: No VRM data in GLTF userData");
          onError();
          return;
        }
        VRMUtils.removeUnnecessaryJoints(gltf.scene);
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        vrm.scene.rotation.y = Math.PI;
        vrmRef.current = vrm;
        if (!loadedRef.current) {
          loadedRef.current = true;
          onLoaded();
        }
      },
      undefined,
      (error) => {
        console.error("VRM load error:", error);
        onError();
      }
    );

    return () => {
      if (vrmRef.current) {
        VRMUtils.deepDispose(vrmRef.current.scene);
        vrmRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vrmUrl]);

  useEffect(() => {
    if (audioAnalyser) {
      freqDataRef.current = new Uint8Array(audioAnalyser.frequencyBinCount);
    } else {
      freqDataRef.current = null;
    }
  }, [audioAnalyser]);

  useFrame(() => {
    const vrm = vrmRef.current;
    if (!vrm) return;

    const delta = clockRef.current.getDelta();
    const elapsed = clockRef.current.elapsedTime;

    vrm.update(delta);

    const head = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Head);
    if (head) {
      head.rotation.y = Math.sin(elapsed * 0.3) * 0.05;
      head.rotation.x = Math.sin(elapsed * 0.2) * 0.02 - 0.05;
    }

    const spine = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Spine);
    if (spine) {
      spine.rotation.z = Math.sin(elapsed * 0.4) * 0.02;
    }

    blinkTimerRef.current += delta;
    if (blinkTimerRef.current >= nextBlinkRef.current) {
      blinkTimerRef.current = 0;
      nextBlinkRef.current = 2 + Math.random() * 4;
      vrm.expressionManager?.setValue("blink", 1);
      setTimeout(() => {
        vrm.expressionManager?.setValue("blink", 0);
      }, 150);
    }

    if (isSpeaking && audioAnalyser && freqDataRef.current) {
      audioAnalyser.getByteFrequencyData(freqDataRef.current);
      const binCount = freqDataRef.current.length;
      const speechStart = Math.floor(binCount * 0.02);
      const speechEnd = Math.floor(binCount * 0.15);
      let sum = 0;
      for (let i = speechStart; i < speechEnd; i++) {
        sum += freqDataRef.current[i];
      }
      const avg = sum / (speechEnd - speechStart);
      const targetMouth = Math.min(avg / 128, 1.0);
      mouthOpenRef.current += (targetMouth - mouthOpenRef.current) * 0.3;
    } else {
      mouthOpenRef.current += (0 - mouthOpenRef.current) * 0.2;
    }

    vrm.expressionManager?.setValue("aa", mouthOpenRef.current);
  });

  return vrmRef.current ? <primitive object={vrmRef.current.scene} /> : null;
}

// ─── Fallback Avatar (CSS-based, professional look) ──────────────────────────

interface FallbackAvatarProps {
  isSpeaking: boolean;
}

function FallbackAvatar({ isSpeaking }: FallbackAvatarProps) {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    const scheduleNextBlink = () => {
      const delay = 2000 + Math.random() * 4000;
      return setTimeout(() => {
        setBlink(true);
        setTimeout(() => {
          setBlink(false);
          scheduleNextBlink();
        }, 150);
      }, delay);
    };
    const timer = scheduleNextBlink();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full h-full flex items-end justify-center pb-2 bg-gradient-to-b from-slate-700 to-slate-800 overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute inset-0 bg-blue-900/20 rounded-lg" />

      <div className="relative z-10 flex flex-col items-center">
        {/* Shoulders / Jacket */}
        <div className="relative">
          {/* Body */}
          <div className="w-36 h-20 bg-slate-700 rounded-t-3xl mx-auto relative overflow-hidden shadow-lg">
            {/* White shirt */}
            <div className="absolute bottom-0 left-8 right-8 h-16 bg-gray-100" />
            {/* Left jacket lapel */}
            <div className="absolute bottom-0 left-0 w-14 h-20 bg-slate-600 rounded-tr-3xl" />
            {/* Right jacket lapel */}
            <div className="absolute bottom-0 right-0 w-14 h-20 bg-slate-600 rounded-tl-3xl" />
            {/* Tie */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-14 bg-blue-700 rounded-b-md" />
            {/* Tie knot */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-4 h-3 bg-blue-800 rounded-sm" />
          </div>

          {/* Neck */}
          <div className="w-8 h-4 bg-amber-200 mx-auto -mt-1" />

          {/* Head */}
          <div className="w-28 h-32 bg-amber-200 rounded-2xl mx-auto relative -mt-1 shadow-xl">
            {/* Grey hair */}
            <div className="absolute -top-3 left-0 right-0 h-12 bg-gray-300 rounded-t-2xl" />
            {/* Side hair */}
            <div className="absolute top-0 -left-1 w-4 h-14 bg-gray-300 rounded-l-xl" />
            <div className="absolute top-0 -right-1 w-4 h-14 bg-gray-300 rounded-r-xl" />

            {/* Forehead */}
            <div className="absolute top-6 left-0 right-0 h-4 bg-amber-200" />

            {/* Glasses frame left */}
            <div className="absolute top-10 left-3 w-9 h-6 border-2 border-gray-700 rounded-md bg-blue-50/20" />
            {/* Glasses bridge */}
            <div className="absolute top-12 left-12 w-4 h-0.5 bg-gray-700" />
            {/* Glasses frame right */}
            <div className="absolute top-10 right-3 w-9 h-6 border-2 border-gray-700 rounded-md bg-blue-50/20" />
            {/* Glasses arms */}
            <div className="absolute top-10 left-1 w-3 h-0.5 bg-gray-700" />
            <div className="absolute top-10 right-1 w-3 h-0.5 bg-gray-700" />

            {/* Eyes */}
            <div
              className={`absolute top-12 left-6 w-3 rounded-full bg-gray-800 transition-all duration-75 ${
                blink ? "h-0.5" : "h-3"
              }`}
            />
            <div
              className={`absolute top-12 right-6 w-3 rounded-full bg-gray-800 transition-all duration-75 ${
                blink ? "h-0.5" : "h-3"
              }`}
            />

            {/* Nose */}
            <div className="absolute top-[72px] left-1/2 -translate-x-1/2">
              <div className="w-1 h-4 bg-amber-300 rounded-b-full mx-auto" />
              <div className="w-5 h-1.5 bg-amber-300 rounded-full -mt-1" />
            </div>

            {/* Beard / stubble */}
            <div className="absolute bottom-2 left-3 right-3 h-8 bg-gray-300/70 rounded-b-2xl" />

            {/* Mouth */}
            <div
              className={`absolute bottom-5 left-1/2 -translate-x-1/2 bg-gray-700 rounded-full transition-all duration-75 ${
                isSpeaking ? "w-6 h-4 bottom-4" : "w-7 h-1.5"
              }`}
            />

            {/* Cheeks (subtle) */}
            <div className="absolute top-16 left-2 w-5 h-3 bg-rose-200/40 rounded-full" />
            <div className="absolute top-16 right-2 w-5 h-3 bg-rose-200/40 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Loading Indicator ────────────────────────────────────────────────────────

function AvatarLoading() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-700 to-slate-800">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-gray-400">Avatar lädt...</span>
      </div>
    </div>
  );
}

// ─── Main AvatarScene Component ───────────────────────────────────────────────

interface AvatarSceneProps {
  vrmUrl?: string;
  isSpeaking: boolean;
  audioAnalyser: AnalyserNode | null;
  className?: string;
}

export function AvatarScene({
  vrmUrl,
  isSpeaking,
  audioAnalyser,
  className = "",
}: AvatarSceneProps) {
  const [displayMode, setDisplayMode] = useState<"loading" | "vrm" | "fallback">(() => {
    // Check WebGL availability immediately
    if (!vrmUrl || !isWebGLAvailable()) return "fallback";
    return "loading";
  });

  useEffect(() => {
    if (!vrmUrl || !isWebGLAvailable()) {
      setDisplayMode("fallback");
    } else {
      setDisplayMode("loading");
    }
  }, [vrmUrl]);

  if (displayMode === "fallback" || !vrmUrl) {
    return (
      <div className={`${className} overflow-hidden`}>
        <FallbackAvatar isSpeaking={isSpeaking} />
      </div>
    );
  }

  if (displayMode === "loading") {
    return (
      <div className={`${className} overflow-hidden`} style={{ position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
          <AvatarLoading />
        </div>
        <Canvas
          camera={{ position: [0, 1.4, 1.8], fov: 30 }}
          style={{ width: "100%", height: "100%" }}
          onCreated={({ gl }) => {
            // If WebGL context is lost immediately, fall back
            gl.domElement.addEventListener("webglcontextlost", () => {
              setDisplayMode("fallback");
            });
          }}
        >
          <ambientLight intensity={0.8} />
          <directionalLight position={[1, 2, 2]} intensity={1.2} />
          <directionalLight position={[-1, 1, -1]} intensity={0.4} />
          <VRMAvatar
            vrmUrl={vrmUrl}
            isSpeaking={isSpeaking}
            audioAnalyser={audioAnalyser}
            onLoaded={() => setDisplayMode("vrm")}
            onError={() => setDisplayMode("fallback")}
          />
        </Canvas>
      </div>
    );
  }

  // displayMode === "vrm"
  return (
    <div className={`${className} overflow-hidden`}>
      <Canvas
        camera={{ position: [0, 1.4, 1.8], fov: 30 }}
        style={{ width: "100%", height: "100%" }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", () => {
            setDisplayMode("fallback");
          });
        }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[1, 2, 2]} intensity={1.2} />
        <directionalLight position={[-1, 1, -1]} intensity={0.4} />
        <VRMAvatar
          vrmUrl={vrmUrl}
          isSpeaking={isSpeaking}
          audioAnalyser={audioAnalyser}
          onLoaded={() => {}}
          onError={() => setDisplayMode("fallback")}
        />
        <OrbitControls
          target={[0, 1.4, 0]}
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>
    </div>
  );
}
