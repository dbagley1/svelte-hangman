import answerCategories from './answerCategories.js';

export const getAnswerFromCategory = (category) => {
  const categoryArray = answerCategories[category]["words"];
  const randomIndex = Math.floor(Math.random() * categoryArray.length);
  return categoryArray[randomIndex].split("~");
};

export const getRandomCategory = () => {
  const categoryArray = Object.keys(answerCategories);
  const randomIndex = Math.floor(Math.random() * categoryArray.length);
  return categoryArray[randomIndex];
};
