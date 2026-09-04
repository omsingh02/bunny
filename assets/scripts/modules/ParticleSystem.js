// ParticleSystem.js - Procedural Particle & Visual FX Subsystem
import { ProceduralModels } from './ProceduralModels.js';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
    }

    createSparkleEffect(position, enabled = true) {
        if (!enabled) return;

        const sparkleGroup = new THREE.Group();

        for (let i = 0; i < 8; i++) {
            const sparkleGeometry = new THREE.SphereGeometry(0.05, 4, 4);
            const sparkleMaterial = new THREE.MeshLambertMaterial({
                color: new THREE.Color().setHSL(Math.random(), 1, 0.7),
                transparent: true,
                opacity: 1
            });

            const sparkle = new THREE.Mesh(sparkleGeometry, sparkleMaterial);
            sparkle.position.copy(position);

            sparkle.userData = {
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.2,
                    Math.random() * 0.3 + 0.1,
                    (Math.random() - 0.5) * 0.2
                ),
                life: 1.0,
                geometry: sparkleGeometry,
                material: sparkleMaterial
            };

            sparkleGroup.add(sparkle);
        }

        sparkleGroup.userData = { type: 'sparkle', life: 1.0 };
        this.particles.push(sparkleGroup);
        this.scene.add(sparkleGroup);
    }

    update(deltaTime = 0.016) {
        const timeScale = deltaTime * 60;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];

            if (particle.userData.type === 'sparkle') {
                particle.userData.life -= 0.05 * timeScale;

                particle.children.forEach(sparkle => {
                    sparkle.position.x += sparkle.userData.velocity.x * timeScale;
                    sparkle.position.y += sparkle.userData.velocity.y * timeScale;
                    sparkle.position.z += sparkle.userData.velocity.z * timeScale;
                    sparkle.userData.velocity.y -= 0.01 * timeScale;
                    sparkle.material.opacity = Math.max(0, particle.userData.life);
                });

                if (particle.userData.life <= 0) {
                    ProceduralModels.disposeHierarchy(particle);
                    this.scene.remove(particle);
                    this.particles.splice(i, 1);
                }
            }
        }
    }

    clear() {
        this.particles.forEach(p => {
            ProceduralModels.disposeHierarchy(p);
            this.scene.remove(p);
        });
        this.particles = [];
    }
}
