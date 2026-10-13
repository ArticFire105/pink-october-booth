export function isCorrectChoice(question, choice) {
  return question.answer === choice;
}

export function scoreQuiz(answers) {
  const total = answers.length;
  const correct = answers.reduce((sum, answer) => sum + (answer.correct ? 1 : 0), 0);
  return {
    correct,
    total,
    percent: total === 0 ? 0 : Math.round((correct / total) * 100),
  };
}

export function scoreHeadline(correct, total) {
  if (total <= 0) return "No questions in this round.";
  if (correct === total) return "Every one.";
  if (correct >= Math.ceil(total * 0.8)) return "Strong round.";
  if (correct >= Math.ceil(total * 0.5)) return "A solid start.";
  return "Worth another pass.";
}

