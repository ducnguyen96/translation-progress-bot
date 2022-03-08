/**
 *
 * @param {string} body
 */
const findTasks = (body) => {
  return body.match(/^(- \[ \] ).*$/gm);
};

/**
 *
 * @param {string[]} tasks
 * @param {string} name
 */
const findTaskByName = (tasks, name) => {
  // Find task that have exact name with comment's body
  const found = tasks.find((task) => {
    const rawName = task.match(/\[[\w\s\-]{2,}\]/g);
    // if not found any match
    if (!rawName) return undefined;

    // remove [, ]
    const taskName = rawName[0].replace(/[\[\]]/g, "");
    // if task's name = comment's body
    if (taskName === name) return true;

    return undefined;
  });
  return found;
};

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  const ISSUE_TITLE = "Translation Progress";
  const ISSUE_NUMBER = 3;
  /**
   * On each comment created: EventTypesPayload
   *
   * Check if there is a task in tasks list that have exactly same name with comment's body
   *  - YES --> check if the task is assigned
   *              - YES --> ignore
   *              - NO  --> assigned the task, react the comment
   *  - NO  --> ignore
   */
  app.on("issue_comment.created", async (context) => {
    // console.log(util.inspect(context, false, null, false /* enable colors */));

    const general = {
      repo: context.payload.repository.name,
      owner: context.payload.repository.owner.login,
    };

    const {
      comment,
      issue: { title, state, body, number },
    } = context.payload;

    // Only works on this issue
    if (!title.includes(ISSUE_TITLE) || state !== "open") return;

    // Task list
    const tasks = findTasks(body);
    if (!tasks) return;

    // Find task that have exact name with comment's body
    const found = findTaskByName(tasks, comment.body);

    // If not found any task with exact comment's body
    if (!found) return;

    // check is assigned
    const assignee = found.match(/\(\@.*\)/g);
    if (assignee) return;

    // assign task
    const assigned = found.replace(".md)", `.md) (@${comment.user.login})`);

    // update the issue
    const updatedCommentBody = body.replace(found, assigned);

    await context.octokit.issues
      .update({
        issue_number: number,
        body: updatedCommentBody,
        ...general,
      })
      .catch((err) => console.log("err1 :", err));

    // react the comment
    await context.octokit.reactions
      .createForIssueComment({
        comment_id: comment.id,
        content: "heart",
        ...general,
      })
      .catch((err) => console.log("err2 :", err));
  });

  /**
   * On each pull request created: EventTypesPayload
   *
   * 1. Get the progress issue
   *
   * 2. Find the task that have same name with pull request's title
   *
   * 3. Not found --> ignore
   *
   * 4. Found check if referenced, if yes --> ignore, if no --> refer and update the issue body.
   */
  app.on("pull_request.opened", async (context) => {
    console.log(util.inspect(context, false, null, false /* enable colors */));
    const { repository, pull_request } = context.payload;
    const general = {
      repo: repository.name,
      owner: repository.owner.login,
    };

    // find the issue
    const progressIssueQuery = await context.octokit.issues.get({
      issue_number: ISSUE_NUMBER,
      ...general,
    });

    if (progressIssueQuery.status !== 200) return;

    const issueBody = progressIssueQuery.data.body;

    if (!issueBody) return;

    // Task list
    const tasks = findTasks(issueBody);
    if (!tasks) return;

    // Find task that have exact name with comment's body
    const found = findTaskByName(tasks, pull_request.title);
    if (!found) return;

    // If the request's author same guy with task's assignee
    const compareAssigneeName = found.search(`(@${pull_request.user.login})`);
    if (compareAssigneeName === -1) return;

    // Find out if referenced
    const regexPattern = `\(\@${pull_request.user.login}\).*#`;
    const regex = new RegExp(regexPattern, "g");
    const isReferenced = found.search(regex);
    if (isReferenced !== -1) return;

    // Refer and update issue body
    const updatedCommentBody = issueBody.replace(found, found + ` #${pull_request.number}`);
    await context.octokit.issues
      .update({
        issue_number: ISSUE_NUMBER,
        body: updatedCommentBody,
        ...general,
      })
      .catch((err) => console.log("err1 :", err));

    // Create a thank you comment
    await context.octokit.issues
      .createComment({
        issue_number: pull_request.number,
        body: `@${pull_request.user.login} :clap: :clap: :clap:\r\nThank you for your submission! We really appreciate your contribution! :pray:`,
        ...general,
      })
      .catch((err) => console.log("err1 :", err));

    // React to comment
    await context.octokit.reactions
      .createForIssue({ content: "heart", issue_number: pull_request.number, ...general })
      .catch((err) => console.log("err1 :", err));

    // Assign
    await context.octokit.issues
      .update({
        assignees: ["ducnguyen96"],
        issue_number: pull_request.number,
        ...general,
        labels: [{ name: "review needed", color: "#B60205", description: "" }],
      })
      .catch((err) => console.log("err1 :", err));
  });

  app.on("pull_request.closed", async (context) => {
    const { repository, pull_request } = context.payload;
    const general = {
      repo: repository.name,
      owner: repository.owner.login,
    };

    // find the issue
    const progressIssueQuery = await context.octokit.issues.get({
      issue_number: ISSUE_NUMBER,
      ...general,
    });

    if (progressIssueQuery.status !== 200) return;

    const issueBody = progressIssueQuery.data.body;

    if (!issueBody) return;

    // Task list
    const tasks = findTasks(issueBody);
    if (!tasks) return;

    // Find task that have exact name with comment's body
    const found = findTaskByName(tasks, pull_request.title);
    if (!found) return;

    const updatedFound = found.replace("- [ ]", "- [x]");

    const updatedCommentBody = issueBody.replace(found, updatedFound);
    await context.octokit.issues
      .update({
        issue_number: ISSUE_NUMBER,
        body: updatedCommentBody,
        ...general,
      })
      .catch((err) => console.log("err1 :", err));
  });
};
