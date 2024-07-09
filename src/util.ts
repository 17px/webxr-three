import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

export const loadModel = (
  url: string,
  partName: string
): Promise<THREE.BufferGeometry> =>
  new Promise((resolve, reject) => {
    const manager = new THREE.LoadingManager();

    manager.onError = (exception) => {
      console.error(`${partName} 加载失败:`, exception);
      reject(new Error(`${partName} 加载失败: ${exception}`));
    };

    const loader = new STLLoader(manager);
    loader.load(
      url,
      (geometry: THREE.BufferGeometry) => {
        resolve(geometry);
      },
      undefined,
      (error) => {
        reject(error);
      }
    );
  });
