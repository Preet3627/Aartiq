"use client";

import { motion } from "framer-motion";
import { WifiOff, Play } from "lucide-react";
import { useState, useEffect, useRef } from "react";

const NoNetworkGame = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [dinoPosition, setDinoPosition] = useState(0); // vertical position
  const [isJumping, setIsJumping] = useState(false);
  const [obstaclePosition, setObstaclePosition] = useState(600); // horizontal position
  const [score, setScore] = useState(0);
  const gameLoopRef = useRef<number>(0);
  const jumpTimerRef = useRef<any>(null);

  const dinoHeight = 50;
  const obstacleWidth = 20;
  const obstacleHeight = 40;
  const groundLevel = 0;
  const jumpHeight = 100;
  const jumpDuration = 500; // ms

  const startGame = () => {
    setIsPlaying(true);
    setScore(0);
    setDinoPosition(groundLevel);
    setObstaclePosition(600); // reset obstacle position
  };

  const jump = () => {
    if (!isJumping) {
      setIsJumping(true);
      setDinoPosition(jumpHeight);

      clearTimeout(jumpTimerRef.current);
      jumpTimerRef.current = setTimeout(() => {
        setDinoPosition(groundLevel);
        setIsJumping(false);
      }, jumpDuration);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && isPlaying) {
        jump();
      } else if (e.code === "Space" && !isPlaying) {
        startGame();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(gameLoopRef.current);
      return;
    }

    const gameLoop = () => {
      setObstaclePosition((prev) => prev - 5);
      setScore((prev) => prev + 1);

      // Check for collision (simplified)
      const dinoX = 50;
      const dinoY = dinoPosition;
      const obstacleX = obstaclePosition;
      const obstacleY = groundLevel;

      if (
        dinoX < obstacleX + obstacleWidth &&
        dinoX + dinoHeight > obstacleX && // Assuming dino is square for simplicity
        dinoY < obstacleY + obstacleHeight &&
        dinoY + dinoHeight > obstacleY
      ) {
        // Collision detected
        setIsPlaying(false);
        alert(`Game Over! Score: ${score}`);
      }

      // Reset obstacle if it goes off screen
      if (obstaclePosition < -obstacleWidth) {
        setObstaclePosition(600 + Math.random() * 200); // randomize next obstacle position
      }

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [isPlaying, dinoPosition, obstaclePosition, score]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-zinc-900 text-white">
      <div className="text-center mb-8">
        <WifiOff size={64} className="text-red-500 mx-auto mb-4" />
        <h2 className="text-4xl font-bold mb-2">No Internet Connection</h2>
        <p className="text-gray-400">
          Looks like you're offline. Press SPACE to play a game!
        </p>
      </div>

      <div className="relative w-[600px] h-[200px] border-b-2 border-white overflow-hidden">
        {isPlaying && (
          <>
            {/* Dino */}
            <motion.div
              className="absolute left-[50px] w-[50px] h-[50px] bg-green-500"
              style={{ bottom: dinoPosition }}
              animate={{ y: dinoPosition }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            ></motion.div>

            {/* Obstacle */}
            <motion.div
              className="absolute bottom-0 w-[20px] h-[40px] bg-red-500"
              style={{ left: obstaclePosition }}
              animate={{ x: obstaclePosition }}
              transition={{ ease: "linear", duration: 0.05 }} // Fast, linear movement
            ></motion.div>

            <div className="absolute top-4 right-4 text-xl font-bold">
              Score: {score}
            </div>
          </>
        )}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-2xl">
            Press SPACE to Start
          </div>
        )}
      </div>
    </div>
  );
};

export default NoNetworkGame;
