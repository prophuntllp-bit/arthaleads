import { useRef, useState, useEffect } from "react";
import { useScroll, useTransform, motion } from "framer-motion";

export function ContainerScroll({ titleComponent, children }) {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const scaleDimensions = isMobile ? [0.7, 0.9] : [1.05, 1];
  const rotate   = useTransform(scrollYProgress, [0, 1], [20, 0]);
  const scale    = useTransform(scrollYProgress, [0, 1], scaleDimensions);
  const translate = useTransform(scrollYProgress, [0, 1], [0, -80]);

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center relative px-4 md:px-16"
      style={{ height: isMobile ? "55rem" : "72rem" }}
    >
      <div
        className="w-full relative"
        style={{ perspective: "1200px", paddingTop: isMobile ? "2.5rem" : "5rem" }}
      >
        {/* Title block – translates up as you scroll */}
        <motion.div style={{ translateY: translate }} className="max-w-4xl mx-auto text-center mb-8 md:mb-12">
          {titleComponent}
        </motion.div>

        {/* Image wrapper – rotates from tilted to flat, no opaque frame */}
        <motion.div
          style={{
            rotateX: rotate,
            scale,
            transformOrigin: "top center",
            filter: "drop-shadow(0 60px 80px rgba(0,0,0,0.28))",
          }}
          className="max-w-5xl mx-auto w-full"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
