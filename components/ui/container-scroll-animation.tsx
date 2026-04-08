"use client";
import React, { useRef } from "react";
import { useScroll, useTransform, motion, MotionValue } from "framer-motion";

export const ContainerScroll = ({
  titleComponent,
  children,
}: {
  titleComponent?: string | React.ReactNode;
  children: React.ReactNode;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const scaleDimensions = () => (isMobile ? [0.7, 0.9] : [1.05, 1]);

  const rotate    = useTransform(scrollYProgress, [0, 1], [20, 0]);
  const scale     = useTransform(scrollYProgress, [0, 1], scaleDimensions());
  const translate = useTransform(scrollYProgress, [0, 1], [0, -100]);

  return (
    <div
      ref={containerRef}
      style={{
        height: isMobile ? "60rem" : "72rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        padding: isMobile ? "8px" : "80px 80px 0",
      }}
    >
      <div style={{ width: "100%", position: "relative", perspective: "1000px" }}>
        {titleComponent && <Header translate={translate} titleComponent={titleComponent} />}
        <Card rotate={rotate} translate={translate} scale={scale}>
          {children}
        </Card>
      </div>
    </div>
  );
};

export const Header = ({ translate, titleComponent }: { translate: MotionValue<number>; titleComponent: React.ReactNode }) => (
  <motion.div
    style={{ translateY: translate, textAlign: "center", marginBottom: "40px" }}
  >
    {titleComponent}
  </motion.div>
);

export const Card = ({
  rotate,
  scale,
  children,
}: {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  translate: MotionValue<number>;
  children: React.ReactNode;
}) => (
  <motion.div
    style={{
      rotateX: rotate,
      scale,
      boxShadow:
        "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003",
      maxWidth: "900px",
      marginTop: "-48px",
      marginLeft: "auto",
      marginRight: "auto",
      height: "520px",
      width: "100%",
      border: "3px solid #c8c8c8",
      padding: "6px",
      background: "#d0d0d0",
      borderRadius: "20px",
    }}
  >
    <div
      style={{
        height: "100%",
        width: "100%",
        overflow: "hidden",
        borderRadius: "14px",
        background: "#fff",
      }}
    >
      {children}
    </div>
  </motion.div>
);
