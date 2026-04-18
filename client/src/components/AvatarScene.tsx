import { useRef, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, VRMHumanBoneName } from "@pixiv/three-vrm";
import type { VRM } from "@pixiv/three-vrm";

// ─── VRM Avatar Component ────────────────────────────────────────────────────

interface VRMAvatarProps {
  vrmUrl: string;
  isSpeaking: boolean;
  audioAnalyser: AnalyserNode | null;
}

function VRMAvatar({ vrmUrl, isSpeaking, audioAnalyser }: VRMAvatarProps) {
  const vrmRef = useRef<VRM | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const blinkTimerRef = useRef(0);
  const nextBlinkRef = useRef(3);
  const mouthOpenRef = useRef(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const freqDataRef = useRef<any>(null);

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      vrmUrl,
      (gltf) => {
        const vrm = gltf.userData.vrm as VRM;
        VRMUtils.removeUnnecessaryJoints(gltf.scene);
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        // Rotate to face camera
        vrm.scene.rotation.y = Math.PI;
        vrmRef.current = vrm;
      },
      undefined,
      (error) => console.error("VRM load error:", error)
    );

    return () => {
      if (vrmRef.current) {
        VRMUtils.deepDispose(vrmRef.current.scene);
        vrmRef.current = null;
      }
    };
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

    // Update VRM animations
    vrm.update(delta);

    // Idle head bob
    const head = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Head);
    if (head) {
      head.rotation.y = Math.sin(elapsed * 0.3) * 0.05;
      head.rotation.x = Math.sin(elapsed * 0.2) * 0.02 - 0.05;
    }

    // Idle body sway
    const spine = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Spine);
    if (spine) {
      spine.rotation.z = Math.sin(elapsed * 0.4) * 0.02;
    }

    // Blinking
    blinkTimerRef.current += delta;
    if (blinkTimerRef.current >= nextBlinkRef.current) {
      blinkTimerRef.current = 0;
      nextBlinkRef.current = 2 + Math.random() * 4;
      // Quick blink
      const blinkExpr = vrm.expressionManager?.getExpression("blink");
      if (blinkExpr !== undefined) {
        vrm.expressionManager?.setValue("blink", 1);
        setTimeout(() => {
          vrm.expressionManager?.setValue("blink", 0);
        }, 150);
      }
    }

    // Lip sync via audio analyser
    if (isSpeaking && audioAnalyser && freqDataRef.current) {
      audioAnalyser.getByteFrequencyData(freqDataRef.current);
      // Average of low-mid frequencies (speech range ~100-3000Hz)
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

    // Apply mouth expression
    const exprManager = vrm.expressionManager;
    if (exprManager) {
      exprManager.setValue("aa", mouthOpenRef.current);
    }
  });

  return vrmRef.current ? <primitive object={vrmRef.current.scene} /> : null;
}

// ─── Fallback Avatar (CSS-based) ─────────────────────────────────────────────

interface FallbackAvatarProps {
  isSpeaking: boolean;
}

function FallbackAvatar({ isSpeaking }: FallbackAvatarProps) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="relative">
        {/* Body */}
        <div className="w-32 h-40 bg-gray-400 rounded-t-3xl mx-auto relative overflow-hidden">
          {/* Shirt */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-white" />
          {/* Jacket */}
          <div className="absolute bottom-0 left-0 w-12 h-20 bg-gray-500 rounded-tr-2xl" />
          <div className="absolute bottom-0 right-0 w-12 h-20 bg-gray-500 rounded-tl-2xl" />
        </div>
        {/* Head */}
        <div className="w-24 h-28 bg-amber-200 rounded-2xl mx-auto relative -mt-2 shadow-md">
          {/* Hair */}
          <div className="absolute -top-2 left-0 right-0 h-10 bg-gray-300 rounded-t-2xl" />
          {/* Glasses frame */}
          <div className="absolute top-8 left-2 right-2 flex justify-center gap-1">
            <div className="w-8 h-5 border-2 border-gray-800 rounded bg-blue-50/30" />
            <div className="w-2 h-0.5 bg-gray-800 mt-2" />
            <div className="w-8 h-5 border-2 border-gray-800 rounded bg-blue-50/30" />
          </div>
          {/* Eyes behind glasses */}
          <div className="absolute top-9 left-4 flex gap-5">
            <div className="w-2 h-2 bg-gray-800 rounded-full" />
            <div className="w-2 h-2 bg-gray-800 rounded-full" />
          </div>
          {/* Nose */}
          <div className="absolute top-14 left-1/2 -translate-x-1/2 w-2 h-2 bg-amber-300 rounded-full" />
          {/* Beard */}
          <div className="absolute bottom-1 left-3 right-3 h-6 bg-gray-300 rounded-b-xl opacity-70" />
          {/* Mouth */}
          <div
            className={`absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-700 rounded-full transition-all duration-75 ${
              isSpeaking ? "w-5 h-3" : "w-6 h-1"
            }`}
          />
        </div>
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
  const [vrmLoaded, setVrmLoaded] = useState(false);
  const [useVRM, setUseVRM] = useState(!!vrmUrl);

  useEffect(() => {
    if (!vrmUrl) {
      setUseVRM(false);
      return;
    }
    // Test if VRM URL is accessible
    fetch(vrmUrl, { method: "HEAD" })
      .then((r) => {
        if (r.ok) {
          setUseVRM(true);
          setVrmLoaded(true);
        } else {
          setUseVRM(false);
        }
      })
      .catch(() => setUseVRM(false));
  }, [vrmUrl]);

  if (!useVRM || !vrmLoaded) {
    return (
      <div className={`${className} bg-gradient-to-b from-slate-100 to-slate-200`}>
        <FallbackAvatar isSpeaking={isSpeaking} />
      </div>
    );
  }

  return (
    <div className={`${className} bg-gradient-to-b from-slate-100 to-slate-200`}>
      <Canvas
        camera={{ position: [0, 1.4, 1.8], fov: 30 }}
        style={{ width: "100%", height: "100%" }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[1, 2, 2]} intensity={1.2} />
        <directionalLight position={[-1, 1, -1]} intensity={0.4} />
        <VRMAvatar
          vrmUrl={vrmUrl!}
          isSpeaking={isSpeaking}
          audioAnalyser={audioAnalyser}
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
