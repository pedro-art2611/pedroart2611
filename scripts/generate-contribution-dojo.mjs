import { mkdir, writeFile } from 'node:fs/promises';

const login = process.env.GITHUB_REPOSITORY_OWNER;
const token = process.env.GITHUB_TOKEN;

if (!login || !token) {
  throw new Error('GITHUB_REPOSITORY_OWNER and GITHUB_TOKEN are required.');
}

const now = new Date();
const from = new Date(now);
from.setUTCDate(from.getUTCDate() - 364);

const query = `query ContributionCalendar($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        weeks {
          contributionDays { date contributionCount weekday }
        }
      }
    }
  }
}`;

const response = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'pedroart2611-contribution-dojo'
  },
  body: JSON.stringify({ query, variables: { login, from: from.toISOString(), to: now.toISOString() } })
});

const payload = await response.json();
if (!response.ok || payload.errors) {
  throw new Error(`Unable to load contribution calendar: ${JSON.stringify(payload.errors ?? payload)}`);
}

const weeks = payload.data.user.contributionsCollection.contributionCalendar.weeks;
const cells = weeks.flatMap((week, column) => week.contributionDays.map((day) => ({ ...day, column })));

const themes = {
  light: {
    background: '#F8F1E5', frame: '#7F1D1D', text: '#292524', muted: '#A8A29E',
    levels: ['#E7DDCD', '#E9C8AF', '#D98B6A', '#B84A39', '#7F1D1D'], brush: '#991B1B', glow: '#D97706'
  },
  dark: {
    background: '#1C1917', frame: '#E7CFA8', text: '#F5F5F4', muted: '#A8A29E',
    levels: ['#302A26', '#5E312B', '#8A3F32', '#B84A39', '#E7CFA8'], brush: '#E7CFA8', glow: '#D97706'
  }
};

function level(count) {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

function render(themeName) {
  const theme = themes[themeName];
  const cell = 11;
  const gap = 4;
  const originX = 64;
  const originY = 80;
  const width = 930;
  const height = 228;
  const pointPath = cells
    .filter((item) => item.contributionCount > 0)
    .map((item) => `${originX + item.column * (cell + gap) + cell / 2},${originY + item.weekday * (cell + gap) + cell / 2}`)
    .join(' ');
  const cellMarkup = cells.map((item) => {
    const x = originX + item.column * (cell + gap);
    const y = originY + item.weekday * (cell + gap);
    return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${theme.levels[level(item.contributionCount)]}"><title>${item.date}: ${item.contributionCount} contribution(s)</title></rect>`;
  }).join('');
  const motionValues = pointPath || `${originX},${originY} ${originX + 660},${originY + 72}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="930" height="228" viewBox="0 0 930 228" role="img" aria-labelledby="title desc">
  <title id="title">Calendário de contribuições de ${login}</title>
  <desc id="desc">Contribuições reais do GitHub em uma composição inspirada em tinta japonesa.</desc>
  <defs>
    <filter id="soft"><feGaussianBlur stdDeviation="3"/></filter>
    <linearGradient id="paper" x1="0" y1="0" x2="930" y2="228"><stop stop-color="${theme.background}"/><stop offset="1" stop-color="${theme.background}"/></linearGradient>
  </defs>
  <rect x="1" y="1" width="928" height="226" rx="12" fill="url(#paper)" stroke="${theme.frame}" stroke-width="2"/>
  <path d="M34 48H896" stroke="${theme.frame}" stroke-opacity=".45"/>
  <text x="36" y="34" fill="${theme.text}" font-family="Georgia, serif" font-size="19" font-weight="700">CONTRIBUTION DOJO</text>
  <text x="894" y="34" text-anchor="end" fill="${theme.muted}" font-family="ui-monospace, monospace" font-size="11" letter-spacing="2">安 · ${login.toUpperCase()}</text>
  <path d="M42 190C180 145 302 203 456 167C604 132 732 184 890 145" fill="none" stroke="${theme.brush}" stroke-opacity=".18" stroke-width="16" stroke-linecap="round" filter="url(#soft)"/>
  <path d="M42 190C180 145 302 203 456 167C604 132 732 184 890 145" fill="none" stroke="${theme.brush}" stroke-opacity=".72" stroke-width="3" stroke-linecap="round" stroke-dasharray="10 14">
    <animate attributeName="stroke-dashoffset" from="0" to="-96" dur="4s" repeatCount="indefinite"/>
  </path>
  ${cellMarkup}
  <polyline points="${motionValues}" fill="none" stroke="transparent" stroke-width="1"/>
  <circle r="4" fill="${theme.glow}">
    <animateMotion dur="9s" repeatCount="indefinite" path="M ${motionValues.replaceAll(' ', ' L ')}"/>
  </circle>
  <circle r="9" fill="${theme.glow}" opacity=".18">
    <animateMotion dur="9s" repeatCount="indefinite" path="M ${motionValues.replaceAll(' ', ' L ')}"/>
    <animate attributeName="r" values="7;13;7" dur="1.2s" repeatCount="indefinite"/>
  </circle>
  <text x="894" y="211" text-anchor="end" fill="${theme.muted}" font-family="ui-monospace, monospace" font-size="10">dados reais · atualização diária</text>
</svg>`;
}

await mkdir('dist', { recursive: true });
await Promise.all([
  writeFile('dist/contribution-dojo.svg', render('light')),
  writeFile('dist/contribution-dojo-dark.svg', render('dark'))
]);
