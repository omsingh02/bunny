// ParticleSystem.js - the little sparkle burst when you grab a treat
export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.bursts = [];
        this.geometry = new THREE.SphereGeometry(0.05, 4, 4); // shared by every sparkle, never disposed
    }

    createSparkleEffect(position, enabled = true) {
        if (!enabled) return;

        const burst = new THREE.Group();
        burst.userData.life = 1;

        for (let i = 0; i < 8; i++) {
            const material = new THREE.MeshLambertMaterial({
                color: new THREE.Color().setHSL(Math.random(), 1, 0.7),
                transparent: true
            });
            const sparkle = new THREE.Mesh(this.geometry, material);
            sparkle.position.copy(position);
            sparkle.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                Math.random() * 0.3 + 0.1,
                (Math.random() - 0.5) * 0.2
            );
            burst.add(sparkle);
        }

        this.bursts.push(burst);
        this.scene.add(burst);
    }

    update(deltaTime) {
        const timeScale = deltaTime * 60; // the tuning below is per-frame at 60fps
        for (let i = this.bursts.length - 1; i >= 0; i--) {
            const burst = this.bursts[i];
            burst.userData.life -= 0.05 * timeScale;

            for (const sparkle of burst.children) {
                const v = sparkle.userData.velocity;
                sparkle.position.x += v.x * timeScale;
                sparkle.position.y += v.y * timeScale;
                sparkle.position.z += v.z * timeScale;
                v.y -= 0.01 * timeScale;
                sparkle.material.opacity = Math.max(0, burst.userData.life);
            }

            if (burst.userData.life <= 0) this.remove(i);
        }
    }

    remove(index) {
        const [burst] = this.bursts.splice(index, 1);
        this.scene.remove(burst);
        burst.children.forEach(sparkle => sparkle.material.dispose()); // materials are per-sparkle (own colour)
    }

    clear() {
        for (let i = this.bursts.length - 1; i >= 0; i--) this.remove(i);
    }
}
