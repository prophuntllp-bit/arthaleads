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
  const translate = useTransform(scrollYProgress, [0, 1], [0, -100]);

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center relative p-2 md:p-20"
      style={{ height: isMobile ? "60rem" : "80rem" }}
    >
      <div className="py-10 md:py-40 w-full relative" style={{ perspective: "1000px" }}>
        {/* Title */}
        <motion.div style={{ translateY: translate }} className="max-w-5xl mx-auto text-center mb-4">
          {titleComponent}
        </motion.div>

        {/* Scrolling card */}
        <motion.div
          style={{
            rotateX: rotate,
            scale,
            height: isMobile ? "30rem" : "40rem",
            boxShadow:
              "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003",
          }}
          className="max-w-5xl -mt-12 mx-auto w-full border-4 border-[#6C6C6C] p-2 md:p-6 bg-[#222222] rounded-[30px] shadow-2xl"
        >
          <div className="h-full w-full overflow-hidden rounded-2xl">
            {children}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
