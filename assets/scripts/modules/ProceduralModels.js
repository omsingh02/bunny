// ProceduralModels.js - High-Performance Pooled Geometries & Asset Generators
export class ProceduralModels {
    static pools = null;

    static initPools() {
        if (ProceduralModels.pools) return;

        ProceduralModels.pools = {
            geometries: {
                stem: new THREE.CylinderGeometry(0.05, 0.05, 1.5),
                petal: new THREE.SphereGeometry(0.3, 8, 8),
                flowerCenter: new THREE.SphereGeometry(0.2, 8, 8),
                log: new THREE.CylinderGeometry(0.3, 0.3, 2),
                rock: new THREE.DodecahedronGeometry(0.5),
                heartCurve: new THREE.SphereGeometry(0.2, 8, 8),
                heartPoint: new THREE.SphereGeometry(0.15, 8, 8),
                starRay: new THREE.CylinderGeometry(0.05, 0.15, 0.6),
                starCenter: new THREE.SphereGeometry(0.15, 8, 8),
                plushBody: new THREE.SphereGeometry(0.25, 8, 8),
                plushHead: new THREE.SphereGeometry(0.15, 8, 8),
                plushEar: new THREE.ConeGeometry(0.05, 0.2, 6),
                grass: new THREE.ConeGeometry(0.1, 0.5, 4)
            },
            materials: {
                stem: new THREE.MeshLambertMaterial({ color: 0x228B22 }),
                flowerCenter: new THREE.MeshLambertMaterial({ color: 0xFFD700 }),
                log: new THREE.MeshLambertMaterial({ color: 0xD2691E }),
                rock: new THREE.MeshLambertMaterial({ color: 0xE6E6FA }),
                heart: new THREE.MeshLambertMaterial({ color: 0xFF69B4 }),
                star: new THREE.MeshLambertMaterial({ color: 0xFFFF99 }),
                plush: new THREE.MeshLambertMaterial({ color: 0x87CEEB }),
                grass: new THREE.MeshLambertMaterial({ color: 0x90EE90 }),
                petals: [
                    new THREE.MeshLambertMaterial({ color: 0xFF69B4 }),
                    new THREE.MeshLambertMaterial({ color: 0xFFB6C1 }),
                    new THREE.MeshLambertMaterial({ color: 0xDDA0DD }),
                    new THREE.MeshLambertMaterial({ color: 0x98FB98 }),
                    new THREE.MeshLambertMaterial({ color: 0xFFFF99 })
                ]
            }
        };
    }

    static disposeHierarchy(obj) {
        if (!obj) return;
        // Do not dispose static pooled geometries/materials as they are reused across the entire session
        if (obj.userData?.isPooled) return;

        obj.traverse((child) => {
            if (child.userData?.isPooled) return;
            if (child.geometry && !child.geometry.userData?.isPooled) child.geometry.dispose();
            if (child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(m => {
                    if (!m.userData?.isPooled) m.dispose();
                });
            }
        });
    }

    static createGround(lanes) {
        const group = new THREE.Group();

        const groundGeometry = new THREE.PlaneGeometry(10, 200);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x98FB98 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        group.add(ground);

        for (let lane of lanes) {
            const pathGeometry = new THREE.PlaneGeometry(1.5, 200);
            const pathMaterial = new THREE.MeshLambertMaterial({ color: 0xF0E68C });
            const path = new THREE.Mesh(pathGeometry, pathMaterial);
            path.rotation.x = -Math.PI / 2;
            path.position.set(lane, 0.01, -50);
            path.receiveShadow = true;
            group.add(path);
        }

        return group;
    }

    static createBunny() {
        const bunnyGroup = new THREE.Group();

        const bodyGeometry = new THREE.SphereGeometry(0.8, 32, 32);
        const bodyMaterial = new THREE.MeshPhongMaterial({
            color: 0xFFB6C1,
            shininess: 30,
            specular: 0xFFFFFF
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.8;
        body.scale.set(1, 1.2, 1);
        body.castShadow = true;
        bunnyGroup.add(body);

        const headGeometry = new THREE.SphereGeometry(0.6, 32, 32);
        const head = new THREE.Mesh(headGeometry, bodyMaterial);
        head.position.set(0, 1.8, 0.2);
        head.castShadow = true;
        bunnyGroup.add(head);

        const earGeometry = new THREE.ConeGeometry(0.15, 0.8, 8);
        const leftEar = new THREE.Mesh(earGeometry, bodyMaterial);
        leftEar.position.set(-0.3, 2.4, 0.1);
        leftEar.rotation.z = 0.2;
        leftEar.castShadow = true;
        bunnyGroup.add(leftEar);

        const rightEar = new THREE.Mesh(earGeometry, bodyMaterial);
        rightEar.position.set(0.3, 2.4, 0.1);
        rightEar.rotation.z = -0.2;
        rightEar.castShadow = true;
        bunnyGroup.add(rightEar);

        const eyeGeometry = new THREE.SphereGeometry(0.12, 16, 16);
        const eyeMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });

        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.2, 1.9, 0.5);
        bunnyGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.2, 1.9, 0.5);
        bunnyGroup.add(rightEye);

        const shineGeometry = new THREE.SphereGeometry(0.04, 8, 8);
        const shineMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });

        const leftShine = new THREE.Mesh(shineGeometry, shineMaterial);
        leftShine.position.set(-0.15, 2.0, 0.55);
        bunnyGroup.add(leftShine);

        const rightShine = new THREE.Mesh(shineGeometry, shineMaterial);
        rightShine.position.set(0.25, 2.0, 0.55);
        bunnyGroup.add(rightShine);

        const noseGeometry = new THREE.SphereGeometry(0.08, 12, 12);
        const noseMaterial = new THREE.MeshPhongMaterial({
            color: 0xFF1493,
            shininess: 80,
            emissive: 0xFF69B4,
            emissiveIntensity: 0.2
        });
        const nose = new THREE.Mesh(noseGeometry, noseMaterial);
        nose.position.set(0, 1.7, 0.55);
        bunnyGroup.add(nose);

        const tailGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const tail = new THREE.Mesh(tailGeometry, bodyMaterial);
        tail.position.set(0, 1, -0.8);
        tail.castShadow = true;
        bunnyGroup.add(tail);

        bunnyGroup.position.set(0, 0, 0);
        return bunnyGroup;
    }

    static createFlower() {
        ProceduralModels.initPools();
        const p = ProceduralModels.pools;
        const flowerGroup = new THREE.Group();
        flowerGroup.userData = { isPooled: true };

        const stem = new THREE.Mesh(p.geometries.stem, p.materials.stem);
        stem.position.y = 0.75;
        stem.castShadow = true;
        flowerGroup.add(stem);

        const petalMaterial = p.materials.petals[Math.floor(Math.random() * p.materials.petals.length)];
        for (let i = 0; i < 6; i++) {
            const petal = new THREE.Mesh(p.geometries.petal, petalMaterial);
            const angle = (i / 6) * Math.PI * 2;
            petal.position.set(Math.cos(angle) * 0.4, 1.5, Math.sin(angle) * 0.4);
            petal.scale.set(0.8, 0.3, 0.8);
            flowerGroup.add(petal);
        }

        const center = new THREE.Mesh(p.geometries.flowerCenter, p.materials.flowerCenter);
        center.position.y = 1.5;
        flowerGroup.add(center);

        return flowerGroup;
    }

    static createLog() {
        ProceduralModels.initPools();
        const p = ProceduralModels.pools;
        const log = new THREE.Mesh(p.geometries.log, p.materials.log);
        log.userData = { isPooled: true };
        log.rotation.z = Math.PI / 2;
        log.position.y = 0.3;
        log.castShadow = true;
        return log;
    }

    static createRock() {
        ProceduralModels.initPools();
        const p = ProceduralModels.pools;
        const rock = new THREE.Mesh(p.geometries.rock, p.materials.rock);
        rock.userData = { isPooled: true };
        rock.position.y = 0.5;
        rock.rotation.x = Math.random() * Math.PI;
        rock.rotation.y = Math.random() * Math.PI;
        rock.castShadow = true;
        return rock;
    }

    static createHeart() {
        ProceduralModels.initPools();
        const p = ProceduralModels.pools;
        const heartGroup = new THREE.Group();
        heartGroup.userData = { isPooled: true };

        const left = new THREE.Mesh(p.geometries.heartCurve, p.materials.heart);
        left.position.set(-0.1, 0.1, 0);
        left.scale.set(1, 0.8, 0.5);
        heartGroup.add(left);

        const right = new THREE.Mesh(p.geometries.heartCurve, p.materials.heart);
        right.position.set(0.1, 0.1, 0);
        right.scale.set(1, 0.8, 0.5);
        heartGroup.add(right);

        const bottom = new THREE.Mesh(p.geometries.heartPoint, p.materials.heart);
        bottom.position.set(0, -0.15, 0);
        bottom.scale.set(0.8, 1.2, 0.5);
        heartGroup.add(bottom);

        return heartGroup;
    }

    static createStar() {
        ProceduralModels.initPools();
        const p = ProceduralModels.pools;
        const starGroup = new THREE.Group();
        starGroup.userData = { isPooled: true };

        for (let i = 0; i < 5; i++) {
            const ray = new THREE.Mesh(p.geometries.starRay, p.materials.star);
            const angle = (i / 5) * Math.PI * 2;
            ray.position.set(Math.cos(angle) * 0.2, 0, Math.sin(angle) * 0.2);
            ray.rotation.z = -angle + Math.PI / 2;
            starGroup.add(ray);
        }

        const center = new THREE.Mesh(p.geometries.starCenter, p.materials.star);
        starGroup.add(center);

        return starGroup;
    }

    static createBunnyPlush() {
        ProceduralModels.initPools();
        const p = ProceduralModels.pools;
        const plushGroup = new THREE.Group();
        plushGroup.userData = { isPooled: true };

        const body = new THREE.Mesh(p.geometries.plushBody, p.materials.plush);
        plushGroup.add(body);

        const head = new THREE.Mesh(p.geometries.plushHead, p.materials.plush);
        head.position.set(0, 0.3, 0);
        plushGroup.add(head);

        const leftEar = new THREE.Mesh(p.geometries.plushEar, p.materials.plush);
        leftEar.position.set(-0.08, 0.45, 0);
        plushGroup.add(leftEar);

        const rightEar = new THREE.Mesh(p.geometries.plushEar, p.materials.plush);
        rightEar.position.set(0.08, 0.45, 0);
        plushGroup.add(rightEar);

        return plushGroup;
    }
}
