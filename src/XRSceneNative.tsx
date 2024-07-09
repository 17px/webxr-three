import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { XRButton } from "three/examples/jsm/webxr/XRButton.js";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";
// @ts-ignore
import { Text } from "troika-three-text";
import { Segments } from "./Segments";
import { loadModel } from "./util";

/**
 * 加载模型
 */
const loadAortaModel = () => {
  return Segments.map((item) => {
    return loadModel(`/${item.dataName}`, item.name).then((geometry) => {
      const mat = new THREE.MeshStandardMaterial({
        color: item.color,
        transparent: true,
        opacity: 0.7,
        roughness: 0.7,
        metalness: 0.0,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.name = item.alias;
      mesh.visible = item.visible;
      return mesh;
    });
  });
};

export default function XRSceneNative() {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const camera = useRef<THREE.PerspectiveCamera>();
  const controls = useRef<OrbitControls>();
  const group = useRef<THREE.Group>(new THREE.Group());
  const scene = useRef<THREE.Scene>();
  const renderer = useRef<THREE.WebGLRenderer>();
  const controller1 = useRef<THREE.XRTargetRaySpace>();
  const controller2 = useRef<THREE.XRTargetRaySpace>();
  const controllerGrip1 = useRef<THREE.XRGripSpace>();
  const controllerGrip2 = useRef<THREE.XRGripSpace>();
  const raycaster = useRef<THREE.Raycaster>();
  const partText = useRef<Text>(new Text());

  // 自定定位
  const autoCenter = () => {
    if (group.current) {
      group.current.rotation.x = -Math.PI / 2;
      const box = new THREE.Box3().setFromObject(group.current);
      const center = box.getCenter(new THREE.Vector3());
      group.current.position.sub(center);
      group.current.position.add(new THREE.Vector3(0, 1.7, -1));
    }
  };

  useEffect(() => {
    Promise.all(loadAortaModel())
      .then((meshList) => {
        meshList.filter(Boolean).forEach((mesh) => {
          mesh.scale.set(0.002, 0.002, 0.002);
          group.current.add(mesh);
          autoCenter();
        });
      })
      .catch((error) => {
        console.error("Error loading STL files", error);
      });
  }, []);

  useEffect(() => {
    init();

    function init() {
      scene.current = new THREE.Scene();
      scene.current.background = new THREE.Color(0xffffff);
      camera.current = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );

      scene.current.add(new THREE.HemisphereLight(0xbcbcbc, 0xa5a5a5, 3));

      partText.current.text = "";
      partText.current.fontSize = 0.5;
      partText.current.color = 0x00ff00;
      partText.current.anchorX = "center";
      partText.current.position.set(0, 1.2, -2);
      partText.current.sync();
      scene.current.add(partText.current);

      const light = new THREE.DirectionalLight(0xffffff, 3);
      light.position.set(0, 6, 0);
      light.castShadow = true;
      light.shadow.camera.top = 3;
      light.shadow.camera.bottom = -3;
      light.shadow.camera.right = 3;
      light.shadow.camera.left = -3;
      light.shadow.mapSize.set(4096, 4096);
      scene.current.add(light);

      scene.current.add(group.current);

      camera.current.position.set(0, 6, 0);

      controls.current = new OrbitControls(camera.current, canvas.current!);
      controls.current.update();

      renderer.current = new THREE.WebGLRenderer({
        canvas: canvas.current!,
        antialias: true,
      });
      renderer.current.setPixelRatio(window.devicePixelRatio);
      renderer.current.setSize(window.innerWidth, window.innerHeight);
      renderer.current.setAnimationLoop(animate);
      renderer.current.shadowMap.enabled = true;
      renderer.current.xr.enabled = true;

      const xrbutton = XRButton.createButton(renderer.current, {
        requiredFeatures: ["local-floor"],
        optionalFeatures: ["depth-sensing", "local-floor", "bounded-floor"],
        depthSensing: {
          usagePreference: ["gpu-optimized"],
          dataFormatPreference: [],
        },
      });
      xrbutton.style.background = "#000";
      document.body.appendChild(xrbutton);

      controller1.current = renderer.current.xr.getController(0);
      controller1.current.addEventListener("selectstart", onSelectStart);
      controller1.current.addEventListener("selectend", onSelectEnd);
      controller1.current.addEventListener("squeeze", onSqueezeSmaller);
      controller2.current = renderer.current.xr.getController(1);
      controller2.current.addEventListener("selectstart", onSelectStart);
      controller2.current.addEventListener("selectend", onSelectEnd);
      controller2.current.addEventListener("squeeze", onSqueezeBigger);

      const controllerModelFactory = new XRControllerModelFactory();

      controllerGrip1.current = renderer.current.xr.getControllerGrip(0);
      controllerGrip1.current.add(
        controllerModelFactory.createControllerModel(controllerGrip1.current)
      );
      controllerGrip2.current = renderer.current.xr.getControllerGrip(1);
      controllerGrip2.current.add(
        controllerModelFactory.createControllerModel(controllerGrip2.current)
      );

      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1),
      ]);

      const line = new THREE.Line(geometry);
      line.name = "line";
      line.scale.z = 5;

      controller1.current.add(line.clone());
      controller2.current.add(line.clone());
      raycaster.current = new THREE.Raycaster();

      scene.current?.add(controller1.current);
      scene.current?.add(controller2.current);
      scene.current?.add(controllerGrip1.current);
      scene.current?.add(controllerGrip2.current);

      window.addEventListener("resize", onWindowResize);
    }

    function onWindowResize() {
      camera.current!.aspect = window.innerWidth / window.innerHeight;
      camera.current!.updateProjectionMatrix();
      renderer.current!.setSize(window.innerWidth, window.innerHeight);
    }

    /**
     * 高亮真个group
     */
    function highlightGroup(highlight: boolean) {
      group.current!.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material.emissive.b = highlight ? 1 : 0;
        }
      });
    }

    /**
     * 获取控制器与射线相交的全部group中的子元素
     */
    function getIntersections(controller: THREE.XRTargetRaySpace) {
      controller.updateMatrixWorld();
      raycaster.current!.setFromXRController(controller);
      return raycaster.current!.intersectObjects(
        group.current!.children,
        false
      );
    }

    function onSelectStart(event: any) {
      const controller = event.target;
      const intersections = getIntersections(controller);

      if (intersections.length > 0) {
        const intersection = intersections[0];
        const object = intersection.object;

        // 检查被选对象是否是group的子元素
        if (group.current && group.current.children.includes(object)) {
          highlightGroup(true); // 高亮整个 group
          controller.attach(group.current); // 将整个 group 附加到控制器上
          controller.userData.selected = group.current; // 标记 group 为已选
        }
      }
    }

    /**
     * 松开选中键
     */
    function onSelectEnd(event: any) {
      const controller = event.target;
      if (controller.userData.selected !== undefined) {
        const worldPosition = new THREE.Vector3();
        const worldQuaternion = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        group.current!.matrixWorld.decompose(
          worldPosition,
          worldQuaternion,
          worldScale
        );

        // 将group从控制器中移除，并加入到场景中
        controller.remove(group.current!);
        scene.current!.add(group.current!);

        // 应用之前记录的世界位置和方向
        group.current!.position.copy(worldPosition);
        group.current!.quaternion.copy(worldQuaternion);
        group.current!.scale.copy(worldScale);
        highlightGroup(false);
        controller.userData.selected = undefined;
      }
    }

    function onSqueezeSmaller() {
      if (group.current) {
        const box = new THREE.Box3().setFromObject(group.current);
        const center = box.getCenter(new THREE.Vector3());
        group.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.scale.x *= 0.98;
            child.scale.y *= 0.98;
            child.scale.z *= 0.98;
          }
        });
        const newBox = new THREE.Box3().setFromObject(group.current);
        const newCenter = newBox.getCenter(new THREE.Vector3());
        group.current.position.add(center).sub(newCenter);
      }
    }

    function onSqueezeBigger() {
      if (group.current) {
        const box = new THREE.Box3().setFromObject(group.current);
        const center = box.getCenter(new THREE.Vector3());
        group.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.scale.x *= 1.02;
            child.scale.y *= 1.02;
            child.scale.z *= 1.02;
          }
        });
        const newBox = new THREE.Box3().setFromObject(group.current);
        const newCenter = newBox.getCenter(new THREE.Vector3());
        group.current.position.add(center).sub(newCenter);
      }
    }

    function getFirstIntersection(controller: THREE.XRTargetRaySpace) {
      if (raycaster.current) {
        const tempMatrix = new THREE.Matrix4();
        tempMatrix.identity().extractRotation(controller.matrixWorld);

        raycaster.current.ray.origin.setFromMatrixPosition(
          controller.matrixWorld
        );
        raycaster.current.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

        const intersections = raycaster.current.intersectObjects(
          group.current.children,
          false
        );
        return intersections.length > 0 ? intersections[0] : null;
      }
    }

    function animate() {
      renderer.current?.render(scene.current!, camera.current!);
      const intersection =
        getFirstIntersection(controller1.current!) ||
        getFirstIntersection(controller2.current!);
      partText.current.text = intersection?.object.name ?? "";
      // camera.current?.updateMatrixWorld();
    }
  }, []);

  return (
    <>
      <canvas
        style={{ position: "absolute", left: 0, right: 0 }}
        ref={canvas}
      ></canvas>
    </>
  );
}
