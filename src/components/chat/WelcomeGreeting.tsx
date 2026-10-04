import { splitGreeting } from "@/lib/utils";
import styles from "./WelcomeGreeting.module.css";

type WelcomeGreetingProps = {
  text: string;
};

/**
 * Two-line display greeting. Copy is passed in so it can stay dynamic with
 * the time of day once personalisation exists.
 */
export function WelcomeGreeting({ text }: WelcomeGreetingProps) {
  const lines = splitGreeting(text);

  return (
    <h1 className={styles.greeting}>
      {lines.map((line) => (
        <span key={line} className={styles.line}>
          {line}
        </span>
      ))}
    </h1>
  );
}