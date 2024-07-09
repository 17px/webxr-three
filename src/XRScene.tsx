import { useFrame, useThree } from "@react-three/fiber";
import { Controllers, RayGrab } from "@react-three/xr";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

const urls = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(
  (i) => `/Segmentation preview_Segment_${i}.stl`
);

function XRScene() {
  const groupRef = useRef<THREE.Group>(null);
  const [geometries, setGeometries] = useState<THREE.BufferGeometry[]>([]);
  const { camera } = useThree();

  useFrame(() => {
    groupRef.current?.lookAt(camera.position);
  });

  useEffect(() => {
    const loader = new STLLoader();
    const loadPromises = urls.map(
      (url) =>
        new Promise<THREE.BufferGeometry>((resolve, reject) => {
          loader.load(
            url,
            (geometry) => resolve(geometry),
            undefined,
            (error) => reject(error)
          );
        })
    );

    Promise.all(loadPromises)
      .then((loadedGeometries) => {
        setGeometries(loadedGeometries);
      })
      .catch((error) => {
        console.error("Error loading STL files", error);
      });

    return () => {
      setGeometries([]);
    };
  }, []);

  /**
   * 站立归零
   */
  useEffect(() => {
    if (groupRef.current && geometries.length === urls.length) {
      groupRef.current.rotation.x = -Math.PI / 2;
      const box = new THREE.Box3().setFromObject(groupRef.current);
      const center = box.getCenter(new THREE.Vector3());
      groupRef.current.position.sub(center);
      groupRef.current.position.add(new THREE.Vector3(0, 1.7, -1));
    }
  }, [geometries.length]);

  return (
    <>
      <Controllers />
      <hemisphereLight
        groundColor={0xa5a5a5} // 半球光源的地面颜色
        intensity={3} // 光源强度
      />
      <directionalLight
        color={0xffffff} // 光源颜色
        intensity={3} // 光源强度
        position={[0, 6, 0]} // 光源位置
        castShadow={true} // 允许投射阴影
        shadow-mapSize-width={4096} // 阴影纹理的宽度
        shadow-mapSize-height={4096} // 阴影纹理的高度
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-camera-right={3}
        shadow-camera-left={-3}
      />
      <RayGrab>
        <group ref={groupRef}>
          {geometries.map((geometry, index) => (
            <mesh key={index} geometry={geometry} scale={[0.002, 0.002, 0.002]}>
              <meshStandardMaterial color="orange" />
            </mesh>
          ))}
        </group>
      </RayGrab>
    </>
  );
}

export default XRScene;
