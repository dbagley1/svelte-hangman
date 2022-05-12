<script>
  import answerCategories from "./answerCategories.js";
  import { fade, fly, slide } from "svelte/transition";
  import { getAnswerFromCategory, getRandomCategory } from "./answerAPI.js";

  const maxLives = 10;
  const letters = "abcdefghijklmnopqrstuvwxyz";

  let activeCategory = getRandomCategory();

  let answerAndHint = getAnswerFromCategory(activeCategory);
  $: hint = answerAndHint[1];
  $: answer = answerAndHint[0];
  $: window.answer = answer;
  $: answerArray = answer?.split("") || [];
  $: answerWords = answer?.split(" ") || [];

  let guesses = [];
  $: wrongGuesses = guesses.filter((letter) => answerArray.indexOf(letter) === -1);

  $: lives = maxLives - wrongGuesses.length;

  $: gameLost = lives <= 0;
  $: gameWon = answerArray.every((letter) => guesses.includes(letter) || letter === " ");
  $: gameOver = gameLost || gameWon;

  let showHint = true;
  let lastGuess = null;

  function guessLetter(letter) {
    if (!gameOver && !guesses.includes(letter)) {
      guesses = [...guesses, letter];
      lastGuess = letter;
    }
  }

  const restartGame = (category = activeCategory) => {
    guesses = [];
    showHint = false;
    lastGuess = null;
    answerAndHint = getAnswerFromCategory(category);
  };

  function handleKeydown(event) {
    if (event.keyCode >= 65 && event.keyCode <= 90) {
      const letter = event.key.toLowerCase();
      const index = letters.indexOf(letter);
      if (index > -1) {
        guessLetter(letter);
      }
    }
  }

  function changeCategory(category) {
    activeCategory = category;
    restartGame(category);
  }
</script>

<main>
  <div><h1>HANGMAN</h1></div>
  <div id="game">
    {#if gameOver}
      <div class="gameOver" transition:fly>
        {#if gameLost}
          <h2>Game Over. The answer was: {answer.toUpperCase()}</h2>
        {/if}
        {#if gameWon}
          <h1>You won in {guesses.length} guesses!</h1>
        {/if}
        <button on:click={() => restartGame()}>Play Again</button>
      </div>
    {/if}
    <div class="guesses-remaining">
      You have <strong>{lives}</strong> lives left.
      <div>
        {#each Array(maxLives).fill(0) as _, i}
          <span transition:fade class="life" class:lost={lives <= i}>❤</span>
        {/each}
      </div>
    </div>
    <div class="guess-container" style={`--guess-letter-width: ${100 / answerArray.length}%`}>
      {#each answerWords as word}
        <div class="guess-word-row">
          {#each word.split("") as letter}
            <div class="guess-letter-wrap" class:space={letter === " "} class:last={lastGuess === letter && !gameOver}>
              {#if guesses.indexOf(letter) > -1}
                <span class="guess-letter found">{letter}</span>
              {:else}
                <span class="guess-letter blank" />
              {/if}
            </div>
          {/each}
        </div>
      {/each}
    </div>
    <div class="letter-container">
      {#each letters.split("") as letter}
        <button
          class="letter-button-wrap"
          class:correct={(lastGuess === letter || gameOver) && answerArray.includes(letter)}
          disabled={guesses.includes(letter) || gameOver}
          on:click={() => guessLetter(letter)}
        >
          <span class="letter-button">{letter}</span>
        </button>
      {/each}
    </div>
    <div class="hint-container">
      <label class="show-hint-check">
        <input type="checkbox" bind:checked={showHint} />
        {showHint ? "Hide" : "Show"} Hint <i class={`fas fa-chevron-${showHint ? "up" : "down"}`} />
      </label>
      {#if showHint}<div transition:slide class="hint">{hint}</div>{/if}
    </div>
    <h2>Choose a Category</h2>
    <div class="categories">
      {#each Object.keys(answerCategories) as category}
        <button class={`category-btn${category === activeCategory ? " active" : ""}`} on:click={() => changeCategory(category)}>
          {answerCategories[category].emoji}
          {category}
        </button>
      {/each}
    </div>
  </div>
</main>

<svelte:window on:keydown={handleKeydown} />

<style lang="scss">
  @import "../docs/app.scss";
</style>
