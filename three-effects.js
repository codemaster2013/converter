(function() {
            // 3D Card Tilt Effect
            const initTilt = () => {
                const cards = document.querySelectorAll('.card');
                cards.forEach(card => {
                    card.addEventListener('mousemove', (e) => {
                        const rect = card.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;
                        const centerX = rect.width / 2;
                        const centerY = rect.height / 2;
                        const rotateX = (y - centerY) / 20;
                        const rotateY = (centerX - x) / 20;
                        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
                        card.style.boxShadow = `0 ${-rotateX * 2}px ${-rotateY * 2}px rgba(0,0,0,0.3)`;
                    });
                    card.addEventListener('mouseleave', () => {
                        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
                        card.style.boxShadow = 'var(--depth-shadow)';
                    });
                });
            };

            // Three.js Background Particles
            const initThree = () => {
                const canvas = document.getElementById('three-canvas');
                if (!canvas) return;
                const scene = new THREE.Scene();
                const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
                const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
                renderer.setSize(window.innerWidth, window.innerHeight);
                renderer.setPixelRatio(window.devicePixelRatio);

                const geometry = new THREE.BufferGeometry();
                const vertices = [];
                for (let i = 0; i < 800; i++) {
                    vertices.push(THREE.MathUtils.randFloatSpread(2000), THREE.MathUtils.randFloatSpread(2000), THREE.MathUtils.randFloatSpread(2000));
                }
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                const material = new THREE.PointsMaterial({ color: 0x8b5cf6, size: 3, transparent: true, opacity: 0.6 });
                const points = new THREE.Points(geometry, material);
                scene.add(points);

                camera.position.z = 500;

                const animate = () => {
                    requestAnimationFrame(animate);
                    points.rotation.x += 0.0002;
                    points.rotation.y += 0.0002;
                    renderer.render(scene, camera);
                };
                animate();

                window.addEventListener('resize', () => {
                    camera.aspect = window.innerWidth / window.innerHeight;
                    camera.updateProjectionMatrix();
                    renderer.setSize(window.innerWidth, window.innerHeight);
                });
            };

            window.addEventListener('DOMContentLoaded', () => {
                initThree();
                initTilt();
            });
        })();
