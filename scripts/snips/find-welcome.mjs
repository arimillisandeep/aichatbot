/** Locate the welcome-message component inside the app component library. */
import { installAuthObserver } from '../kore-api.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const STREAM = 'st-a26d2d94-7296-534b-ba83-b80aaf937136';

export default async function run(page, h) {
  await installAuthObserver(page);
  await h.enterApp();
  await h.wait(3000);

  const data = await page.evaluate(async (streamId) => {
    const headers = window.__koreAuthHeaders || {};
    const response = await fetch(
      `https://platform.kore.ai/api/1.1/builder/streams/${streamId}/components`,
      { headers, credentials: 'include' },
    );
    return response.json();
  }, STREAM);

  mkdirSync('output/kore', { recursive: true });
  writeFileSync('output/kore/components.all.json', JSON.stringify(data, null, 2));

  const welcome = data.filter((component) => {
    const text = JSON.stringify(component.message || []);
    return /welcome/i.test(component.name || '') || /welcome/i.test(text);
  });

  const byType = {};
  for (const component of data) {
    byType[component.type] = (byType[component.type] || 0) + 1;
  }

  return JSON.stringify(
    {
      total: data.length,
      byType,
      welcome: welcome.map((component) => ({
        _id: component._id,
        name: component.name,
        type: component.type,
        label: component.label,
        text: (component.message || []).map((entry) => entry.text),
      })),
    },
    null,
    1,
  );
}