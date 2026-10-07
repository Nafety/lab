import { CHEMISTRY } from '../data/chemistry';
import { chemistryQuestions } from '../live';
import { el, shuffle } from './game';
import { PanelQuiz } from './panel-quiz';
import './workshops.css';

const LIQUIDS = ['#4fae6a', '#c24a80', '#3a8cc4', '#d9a62e'];

/** Atelier Chimie : chaque réponse est une fiole ; la bonne bouillonne, les mauvaises fument. */
export function createChemistryGame() {
  return new PanelQuiz({
    className: 'chem-quiz',
    title: 'Paillasse du chimiste',
    kicker: (i, n) => `Expérience n° ${i + 1} sur ${n}`,
    pool: CHEMISTRY,
    live: chemistryQuestions,
    count: 8,
    quitLabel: 'Quitter la paillasse',
    view: (ctx) => ctx.refs.anchors.chemistry.view,
    renderChoices: (container, q, onDone) => {
      container.classList.add('flasks');
      const order = shuffle(q.choices.map((text, i) => ({ text, i })));
      const colors = shuffle(LIQUIDS);
      const flasks = order.map(({ text, i }, k) => {
        const f = el('button', 'flask');
        f.style.setProperty('--liq', colors[k]);
        f.style.setProperty('--d', `${k * 0.08}s`);
        f.innerHTML = `
          <div class="flask-glass"><div class="flask-liquid"><i></i><i></i><i></i><i></i><i></i></div></div>
          <div class="smoke"><i></i><i></i><i></i></div>
          <div class="flask-label">${text}</div>`;
        f.addEventListener('click', () => {
          flasks.forEach((x) => (x.disabled = true));
          const ok = i === 0;
          f.classList.add(ok ? 'right' : 'wrong');
          if (!ok) flasks[order.findIndex((o) => o.i === 0)].classList.add('right');
          onDone(ok);
        });
        container.appendChild(f);
        return f;
      });
    },
  });
}
