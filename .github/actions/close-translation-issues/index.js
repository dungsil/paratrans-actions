const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    const gameType = core.getInput('game', { required: true });
    const token = core.getInput('github-token', { required: true });
    const octokit = github.getOctokit(token);
    const { context } = github;

    const filePath = path.join(process.cwd(), `${gameType}-untranslated-items.json`);

    // 번역되지 않은 항목이 없는 경우 처리
    const hasNoUntranslatedItems = !fs.existsSync(filePath) ||
      (() => {
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          return !data.items || data.items.length === 0;
        } catch (e) {
          core.error(`Failed to parse untranslated items file: ${e.message}`);
          return false; // Treat parse errors as having items to process
        }
      })();

    if (hasNoUntranslatedItems) {
      core.info('번역되지 않은 항목이 없습니다.');

      try {
        // 기존 열린 이슈가 있으면 업데이트
        const existingIssues = await octokit.rest.issues.listForRepo({
          owner: context.repo.owner,
          repo: context.repo.repo,
          state: 'open',
          labels: `translation-refused,${gameType}`
        });

        if (existingIssues.data.length > 0) {
          const timestamp = new Date().toISOString();

          for (const issue of existingIssues.data) {
            // 기존 본문에서 마지막 업데이트 시간 부분과 footer 제거
            let existingBody = issue.body || '';
            existingBody = existingBody.replace(/\*\*마지막 업데이트\*\*:[^\n]*\n*/g, '');
            existingBody = existingBody.replace(/\n---\n[\s\S]*$/, '');

            // 성공 메시지 추가
            let updatedBody = existingBody + '\n\n';
            updatedBody += `---\n\n`;
            updatedBody += `✅ **모든 항목이 성공적으로 번역되었습니다.**\n\n`;
            updatedBody += `**마지막 업데이트**: ${timestamp}\n\n`;
            updatedBody += `---\n`;
            updatedBody += `이 이슈는 자동으로 생성 및 관리되었습니다.\n`;

            await octokit.rest.issues.update({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: issue.number,
              body: updatedBody,
              state: 'closed'
            });

            core.info(`이슈 #${issue.number}를 업데이트하고 닫았습니다.`);
          }
        }
      } catch (error) {
        core.error(`Failed to update translation-refused issues: ${error.message}`);
        // Continue execution even if issue update fails
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
