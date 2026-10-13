import test from 'node:test';
import assert from 'node:assert/strict';
import { PINK_QUIZ_QUESTIONS } from '../js/questions-bank.js';
import { pickQuestions } from '../js/quiz-round.js';
import { scoreQuiz, isCorrectChoice } from '../js/quiz.js';

test('four unique questions come from the unchanged bank and either side can be correct', () => {
  const original = structuredClone(PINK_QUIZ_QUESTIONS);
  for (const rng of [() => 0, () => .999]) {
    const round = pickQuestions(PINK_QUIZ_QUESTIONS, 4, rng);
    assert.equal(round.length, 4);
    assert.equal(new Set(round.map(q => q.prompt)).size, 4);
    for (const q of round) {
      const row = PINK_QUIZ_QUESTIONS.find(r => r[0] === q.prompt);
      assert.equal(q.correct, row[1]);
      assert.deepEqual(new Set([q.left, q.right]), new Set(row.slice(1)));
      assert.equal(q.answer, rng() < .5 ? 'myth' : 'fact');
      assert.equal(q.answer === 'myth' ? q.left : q.right, row[1]);
      assert.ok(isCorrectChoice(q, q.answer));
      assert.ok(!isCorrectChoice(q, q.answer === 'myth' ? 'fact' : 'myth'));
    }
    assert.deepEqual(scoreQuiz(round.map(q => ({ correct: isCorrectChoice(q, q.answer) }))),
      { correct: 4, total: 4, percent: 100 });
  }
  assert.deepEqual(PINK_QUIZ_QUESTIONS, original);
  assert.notDeepEqual(pickQuestions(original, 4, () => 0).map(q => q.prompt),
    pickQuestions(original, 4, () => .999).map(q => q.prompt));
});
test('duplicate prompts cannot enter a round; malformed or undersized banks are rejected', () => {
  const row = ['Question', 'Correct', 'Wrong'];
  assert.throws(() => pickQuestions([row, row], 2), RangeError);
  assert.throws(() => pickQuestions([['Missing answers']]), TypeError);
  assert.throws(() => pickQuestions([], 4), RangeError);
});
