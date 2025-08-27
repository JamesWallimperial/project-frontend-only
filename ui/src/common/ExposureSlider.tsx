import type { ChangeEvent } from "react";
import styles from "../setup/Setup.module.css";

type Props = {
  value: number;              // 1..5
  onChange: (level: number) => void;
};

export default function ExposureSlider({ value, onChange }: Props) {
  const level = Math.max(1, Math.min(5, value));
  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  };

  const ariaText = ["1 Low", "2", "3", "4", "5 High"];

  return (
    <div className={styles.exposureWrap}>
      
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={level}
        onChange={handle}
        className={styles.exposureRange}
        aria-label="Exposure level"
        aria-orientation="vertical"
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={level}
        aria-valuetext={ariaText[level - 1]}
      />
      <div className={styles.exposureTicks} aria-hidden="true">
        <span>5</span>
        <span>4</span>
        <span>3</span>
        <span>2</span>
        <span>1</span>
      </div>
    </div>
  );
}
