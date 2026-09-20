import { log } from './state.js';

export function getMedal(state) {
  const dead = state.explorers.filter(e => e.state === 'dead').length;
  if (dead === 0) return 'Légendaire';
  if (dead === 1) return 'Or';
  if (dead === 2) return 'Argent';
  return 'Bronze';
}

export function isAllDown(state) {
  const inPlay = state.explorers.filter(e => e.state === 'active' || e.state === 'down');
  if (inPlay.length === 0) return false;
  return inPlay.every(e => e.state === 'down');
}

export function isAllDeadOrEscaped(state) {
  return state.explorers.every(e => e.state === 'dead' || e.state === 'escaped');
}

export function canStillPlay(state) {
  return state.explorers.some(e => e.state === 'active');
}

export function checkEndConditions(state) {
  if (state.artifactEscaped) {
    state.winner = 'players';
    state.medal = getMedal(state);
    log(state, `Victoire des explorateurs ! Médaille: ${state.medal}`);
    return true;
  }

  if (state.artifactSwallowed) {
    state.winner = 'game';
    state.medal = 'Oubliés à jamais';
    log(state, "Défaite: l'Artefact est englouti par la lave. Oubliés à jamais.");
    return true;
  }

  if (isAllDeadOrEscaped(state)) {
    state.winner = 'game';
    state.medal = null;
    log(state, 'Défaite: tous les explorateurs sont morts ou sortis.');
    return true;
  }

  if (isAllDown(state)) {
    state.winner = 'game';
    state.medal = null;
    log(state, 'Défaite: tous les explorateurs sont à terre.');
    return true;
  }

  return false;
}
