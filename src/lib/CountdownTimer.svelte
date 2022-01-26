<script>
  import { onMount } from "svelte";

  export let goLiveData;
  export let goLiveDateTimeString;

  let time = new Date();
  const dropDate = new Date(goLiveData * 1000);
  const showCountdown = time.valueOf() < dropDate.valueOf();

  $: distance = dropDate.valueOf() - time.valueOf();

  $: days = Math.floor(distance / (1000 * 60 * 60 * 24));
  $: hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  $: minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  $: seconds = Math.floor((distance % (1000 * 60)) / 1000);

  onMount(() => {
    const interval = setInterval(() => {
      time = new Date();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  });
</script>

{#if showCountdown}
  <p>⏰ <span class="label">Candy Drop Countdown</span> ⏰</p>
  <p class="data">
    {days}d {hours}h {minutes}m {seconds}s
  </p>
{:else}
  <p>⏰ <span class="label">Drop Date</span> ⏰</p>
  <p class="data">{goLiveDateTimeString}</p>
{/if}
