import { QuizHeaderBadge } from "./QuizHeader";
import styles from "./QuizIntroduction.module.css";

const STEPS = [
  {
    id: "define",
    title: "Define",
    description: "Subject, topic and the material the quiz should be built from.",
  },
  {
    id: "source",
    title: "Choose the source",
    description: "AI generated, retrieved from a database, or a mix of both.",
  },
  {
    id: "tune",
    title: "Tune",
    description: "Difficulty, count, language and the rules for each question.",
  },
];

/**
 * Static orientation band. It explains the workspace shape.
 */
export function QuizIntroduction() {
  return (
    <section className={styles.root} aria-label="How the quiz builder works">
      <div className={styles.head}>
        <div className={styles.text}>
          <h2 className={styles.title}>Build a quiz in three moves</h2>
          <p className={styles.description}>
            Everything is configured before anything is created. Review the setup
            below and adjust any block before you generate.
          </p>
        </div>
        <QuizHeaderBadge>AI generation live</QuizHeaderBadge>
      </div>

      <ol className={styles.steps}>
        {STEPS.map((step, index) => (
          <li key={step.id} className={styles.step}>
            <span className={styles.stepIndex} aria-hidden>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className={styles.stepText}>
              <span className={styles.stepTitle}>{step.title}</span>
              <span className={styles.stepDescription}>{step.description}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}