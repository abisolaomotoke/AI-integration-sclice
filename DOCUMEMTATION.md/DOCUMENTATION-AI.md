# DOCUMENTATION.md

## Section 1: What This Is

This slice lets a signed in user upload a photo of a handwritten note. The upload happens right away, but the actual reading of the note happens in the background using Google's Gemini AI. Once it's done, the app shows a structured breakdown of the note: a title, the main points as bullets, any action items, and any dates mentioned. The user can also ask for a summary or an expanded version of that content, and this runs through a second AI call.

I left out things like a landing page, editing, and sharing on purpose. They were not part of the goal of this assessment. The brief asks for one working slice, not a full product, so I focused on the upload, the background processing, and the two AI roles instead of adding extra screens.

## Section 2: How To Run It

What to install:
- Node.js 18 or newer
- PostgreSQL, running locally or a connection string to a hosted instance
- A Gemini API key from Google AI Studio

Environment variables (see `.env.example`):
- `DATABASE_URL`, the Postgres connection string
- `GEMINI_API_KEY`, from https://aistudio.google.com/app/apikey

Steps from a fresh clone:
1. `npm install`
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and `GEMINI_API_KEY`
3. `npx prisma migrate dev --name init`
4. `npx prisma generate`
5. `npm run dev`, starts the app at `http://localhost:3000`
6. In a second terminal: `npm run worker`. Nothing gets processed without this running.

## Section 3: The Flow, Step By Step

1. The user signs up or logs in (`src/app/signup/page.tsx`, `src/app/login/page.tsx`), which calls `src/app/api/auth/signup/route.ts` or `src/app/api/auth/login/route.ts`. On success a session cookie is set (`src/lib/session.ts`) and the user is sent to `/dashboard`.

2. On the dashboard (`src/app/dashboard/page.tsx`), the user clicks "Upload a note" and goes to `/upload` (`src/app/upload/page.tsx`), where they pick an image file.

3. Submitting the form sends the file to `src/app/api/upload/route.ts`. This route checks the user is signed in, checks the file type and size against `src/lib/config.ts`, saves the file with `saveUpload` in `src/lib/storage.ts`, creates a `Note` row with the storage key, and creates a `Job` row with `type: extraction` and `status: pending`. It returns right away. It does not wait for any AI call.

4. The frontend redirects to `/notes/[id]` (`src/app/notes/[id]/page.tsx`), which fetches the note from `src/app/api/notes/[id]/route.ts` and checks again every 2 seconds while the job is still pending or processing.

5. Separately, `src/lib/jobs/worker.ts` runs in its own process. Every 1.5 seconds it looks for jobs with `status: pending`, and works on up to 3 at a time using the concurrency cap in `src/lib/queue.ts`.

6. For an extraction job, the worker calls `processExtraction` in `src/lib/jobs/processExtraction.ts`. This reads the image back from disk, sends it to Gemini with a prompt asking for a title, bullet points, action items, and dates as JSON, checks the response against a zod schema in `src/lib/schemas.ts`, and if it's valid, saves the result onto the `Note` row and marks the job `completed`.

7. Once extraction is done, the note page shows the result and two buttons, "Summarize" and "Expand". Clicking one calls `src/app/api/notes/[id]/follow-up/route.ts`, which saves the chosen action on the note and creates a second `Job` row with `type: follow_up`.

8. The worker picks this up the same way, but runs `processFollowUp` in `src/lib/jobs/processFollowUp.ts` instead. This sends the already extracted text, not the image, to Gemini with a different prompt, validates the response, and saves the result.

## Section 4: The Data Model

**User**, one row per account.
- `id`, the primary key
- `email`, unique, so two accounts can never share a login
- `passwordHash`, the bcrypt hash, never the plain password
- `createdAt`

**Note**, one row per uploaded note.
- `id`, `userId`, which user owns this note, with a foreign key to `User`
- `storageKey`, where the image lives on disk. Only the key is stored, never the file
- `mimeType`, the image's content type
- `extractedTitle`, `extractedBulletPoints`, `extractedActionItems`, `extractedDatesMentioned`, all nullable, because they don't exist until extraction finishes. They use the `Json` type because bullet points, action items, and dates are each a list of strings
- `followUpAction`, `followUpResult`, nullable, filled in once a follow-up job finishes

**Job**, one row per background task.
- `id`, `noteId`, which note this job belongs to, with a foreign key to `Note`
- `type`, either `extraction` or `follow_up`
- `status`, `pending`, `processing`, `completed`, or `failed`, defaulting to `pending`
- `attempts`, how many times this job has been tried, used to decide when to stop retrying
- `error`, the last error message, so a failure is never silent
- `rawOutput`, the raw JSON Gemini returned, kept alongside the parsed result

The unique constraint on `User.email` means two accounts can never share a login, even if two signups happen at the same time, because Postgres rejects the second insert. The foreign keys from `Note` to `User` and from `Job` to `Note` mean a job or note can never point at an owner that doesn't exist. The indexes on `userId`, `noteId`, and `status` keep the main queries fast, such as a user's notes, a note's jobs, and the worker's search for pending jobs.

## Section 5: The Concepts

### What an API endpoint is

An API endpoint is a URL a program can call to do something or get data back, instead of a person clicking through a page. In this project, `/api/upload` is an endpoint the upload page calls to hand over a file, and it sends back JSON, not a webpage.

Why it is needed: without a clear endpoint, the frontend has no defined way to ask the backend to do something. It also lets the upload and the AI processing happen as two separate steps instead of one long request that waits for both.

How I implemented it: each endpoint is a `route.ts` file inside `src/app/api/...`, following the Next.js App Router convention, exporting a `POST` or `GET` function.

What I chose against: I did not build a separate backend server talking to a separate frontend. Next.js's built in API routes were enough for this slice and kept everything in one project.

### SDKs versus raw HTTP

An SDK is a package a company gives you so you don't have to build the raw requests yourself. Raw HTTP means writing the request by hand.

Why it is needed: the raw Gemini API expects a specific request shape and handles errors its own way. The official SDK wraps that so I call a normal function instead.

How I implemented it: `src/lib/gemini.ts` creates one shared client using the SDK, using `GEMINI_API_KEY` from the environment. Every file that needs Gemini imports this client.

What I chose against: I did call the raw REST endpoint once, with `curl`, while debugging which models my key could access. But for the actual app code I used the SDK, since it's officially supported.

### System prompts versus user prompts

A system prompt tells the model what role to play and how to behave. A user prompt is the specific input for that one call.

Why it is needed: without a system prompt, the model has no fixed instructions and might answer however it wants, which is a problem when I need the same structure back every time.

How I implemented it: extraction and follow-up each have their own system prompt. The extraction prompt tells the model to transcribe handwriting and return a title, bullets, action items, and dates as JSON, and to say when handwriting is illegible instead of guessing. The follow-up prompt tells the model to summarize or expand already extracted content without inventing new facts.

What I chose against: I chose two separate prompts instead of one shared prompt with an if this then that instruction, because the two tasks are different enough that mixing them risked the model doing either one worse.

### Model parameters

Temperature controls how random or safe the model's word choices are. Max output tokens caps how long a reply can be. Thinking budget, on newer Gemini models, controls how many tokens the model spends reasoning before it answers.

Why it is needed: for a transcription task, a high temperature can make the model smooth over or guess illegible words. Left uncapped, a reply could run long for no reason. Thinking budget matters because it is on by default and counts against the same limit as the actual answer.

How I implemented it: extraction uses `temperature: 0.2`, since this is transcription, not creative writing, and `maxOutputTokens: 4000`. Follow-up uses `temperature: 0.5` and `maxOutputTokens: 2000`. Both turn off thinking with `thinkingConfig: { thinkingBudget: 0 }`, after I found the default thinking behaviour was using up almost the whole token budget before any real output came out.

What I chose against: I originally left the cap at 1000 and didn't touch thinking budget at all, since I didn't know it existed. I found out it mattered the hard way, and that's in Section 6.

### Structured output and schema validation

Structured output means asking the model to return data in an exact shape instead of free text. Schema validation means checking that shape myself once the response comes back, instead of trusting the model got it right.

Why it is needed: even when asked for JSON, a model can return something slightly off, like a missing field or a response cut off midway. If I saved that straight to the database, a broken result could look like a success.

How I implemented it: I request JSON with `responseMimeType: "application/json"` and instructions describing the exact shape. On receipt, I parse the text and run it through a zod schema in `src/lib/schemas.ts`. If parsing or validation fails, it's treated as a failed attempt, not a success. I also check the response's `finishReason` for `MAX_TOKENS` before trying to parse it, since a cut off response fails to parse anyway, and I wanted that failure to have a clear message.

What I chose against: I could have trusted Gemini's own schema enforcement and skipped my own check. I didn't, because the brief asks for validating on receipt in my own code, and because a validation failure should give a clear message, not a confusing parsing crash.

### Jobs and workers

A job is a row in the database that represents one unit of background work. A worker is a separate running process that looks for jobs and does them.

Why it is needed: calling an AI model can take several seconds. If the upload request waited for that, the user would be stuck watching a spinner, and a slow AI call would fail the whole upload. Splitting it into a job the upload creates, and a worker that handles it later, means the upload responds right away.

How I implemented it: the `Job` table holds `status`, `attempts`, and `error` for each unit of work. `src/lib/jobs/worker.ts` runs as its own process, polling for pending jobs every 1.5 seconds.

What I chose against: I did not use a dedicated queue system like BullMQ. For a slice this size, a worker reading straight from the `Job` table was simpler to build, and the brief allows a documented local equivalent.

### Queues, and why concurrency is capped

Here, the queue is really just the set of pending jobs in the database. Concurrency is how many of them run at the same time.

Why it is needed: without a cap, uploading many files at once would fire that many calls to Gemini at once, which is harder to control and more likely to hit rate limits all together.

How I implemented it: `src/lib/queue.ts` tracks how many jobs are active and only starts a new one once a slot is free, capped at 3. The worker only pulls as many pending jobs as there is free capacity for.

What I chose against: I considered no cap at all. I chose 3 instead, since it's small enough to control cost and stay under Gemini's rate limits while still handling more than one note at a time.

### Rate limiting as a cost control

Rate limiting caps how many times something can be called in a given time window.

Why it is needed: without it, someone could hit the upload or follow-up endpoint over and over, and each call is a real Gemini request that costs something. This is a cost control as much as anything else.

How I implemented it: `src/lib/rateLimit.ts` is a simple in-memory sliding window, keyed per user. Upload is capped at 5 per minute, follow-up at 10 per minute.

What I chose against: I chose an in-memory limiter over a shared one like Redis, since this app runs as a single process. This is a real limitation, and it's in Section 7.

### Why files live in object storage rather than the database

Object storage means keeping files on disk or in a cloud bucket, separate from the database, with only a reference stored in the database.

Why it is needed: databases are slow and expensive at holding large files compared to a filesystem or object store, and every query on that table gets slower as it fills with data it doesn't need to read most of the time.

How I implemented it: `src/lib/storage.ts` saves uploaded images under `public/uploads/<userId>/<random id>.<ext>` on the local filesystem, and returns only that key. The `Note.storageKey` column stores this key, never the file. In production, this same module could upload to a real bucket like S3 instead, without changing the code that calls it.

What I chose against: I did not set up real cloud storage for this local build. The brief allows a documented local equivalent, and setting up cloud credentials wasn't the point of this assessment.

### Cost model

Each extraction call sends one image and a short prompt to `gemini-3.6-flash`, capped at 4000 output tokens. Each follow-up call sends a small amount of text, capped at 2000 output tokens. With the concurrency cap of 3, at most 3 calls run at once, which limits how much can be spent in a short burst.

My Gemini key is on the free tier, which has its own rate limit separate from anything I control in my code. I set my concurrency cap at 3 on purpose, below that provider limit, so normal use stays under it. I tested this directly by firing 5 uploads at once, which is covered in Section 6.

## Prove It Works

**Jobs table showing a successful run and a failed run, with the error visible on the failure**
[Screenshot: Prisma Studio, Job table, one row with status completed and one row with status failed, error field expanded]

**Raw model output alongside the validated, parsed result**
[Screenshot: Job row's rawOutput field]
[Screenshot: matching Note row's extractedTitle, extractedBulletPoints, extractedActionItems, extractedDatesMentioned]

**Evidence of what happens when validation fails**
[Screenshot: Job row's error field showing the zod validation error, from the test where I temporarily changed the title schema to require at least 500 characters]
[Screenshot: worker terminal showing the same validation failure]

**Concurrency cap and provider rate limit**
[Screenshot: Job table after firing 5 uploads at once, showing the batch of jobs created together and the quota exhausted error on the failed rows]

## Section 6: What Went Wrong

**Problem 1: the model name did not exist.**
Symptom: every extraction job failed right away with a 404 error mentioning `models/gemini-1.5-flash is not found`.
Investigation: I checked my code for typos, and it was fine. I then queried Google's own models endpoint directly with my API key to confirm which models were actually available, instead of guessing a name and hoping it worked.
Cause: `gemini-1.5-flash` was not available for my key.
Fix: switched to `gemini-2.5-flash`, which was in the list my key returned.

**Problem 2: the replacement model also failed.**
Symptom: after switching, jobs still failed with a 404, this time saying the model was no longer available to new users and naming `gemini-3.6-flash` as the replacement.
Investigation: I read the new error message carefully instead of assuming it was the same issue as before, since the wording was different.
Cause: `gemini-2.5-flash` was listed by the models endpoint, but that didn't mean it was actually available for my account. Being listed doesn't guarantee access.
Fix: switched to `gemini-3.6-flash`, the name the error message itself gave me.

**Problem 3: valid looking requests were coming back as broken JSON.**
Symptom: after fixing the model name, some jobs failed while parsing the response, even though the code looked correct.
Investigation: I checked the token usage on a failing call and found it had used close to 1900 tokens on thinking alone, against a cap of 1000 total.
Cause: newer Gemini models spend tokens on internal reasoning by default, and this comes out of the same limit as the actual answer, so the real output was getting cut off before it finished.
Fix: raised the token caps to 4000 for extraction and 2000 for follow-up, turned thinking off with `thinkingConfig: { thinkingBudget: 0 }` since a transcription task doesn't need reasoning, and added a check for `finishReason === "MAX_TOKENS"` before trying to parse, so a cut off response gives a clear message instead of a confusing parse error.

**Problem 4: some jobs failed with a high demand error.**
Symptom: even after everything else was fixed, some uploads still failed, and trying the same upload again a minute later would work.
Investigation: I read the full error text instead of assuming it was another version of the earlier problems.
Cause: Gemini was returning a temporary overload response, not something wrong in my code.
Fix: added a check for this kind of message and a short delay before the automatic retry, so a retry doesn't hit the same busy moment right away. This doesn't guarantee success every time, since it's a real limit of the free tier, not something I can remove completely.

**Problem 5: testing the concurrency cap uncovered a provider level rate limit.**
Symptom: to test that my concurrency cap actually holds under a burst, I fired 5 uploads at almost the same time. All 5 came back as failed jobs.
Investigation: I opened the failed jobs in Prisma Studio and read the error field on each one instead of assuming it was a code bug.
Cause: the error said Gemini's quota or rate limit was exhausted, with a limit of 5. My own concurrency cap of 3 controls how many requests my worker sends out at once, but it has no way to know about or protect against a limit set on Google's side for my account. Firing 5 requests at once hit that account level limit directly, regardless of my own cap.
Fix: there is no code fix for this, since it is a real limit of the free tier, not a bug. What this test did show is why setting my own cap at 3, below the account limit of 5, is a reasonable choice, since it reduces how often normal use would hit this ceiling. I did not get a chance to re-test with a smaller burst safely under the quota, so I do not have a completed example of the cap holding with everything succeeding.

## Section 7: What This Slice Does Not Handle

Sessions live in memory in the running server process. If the server restarts, everyone is signed out, and this wouldn't work correctly across more than one server instance. A real deployment would need a shared session store.

The rate limiter is also in-memory and per-process, for the same reason. It wouldn't correctly limit a user across multiple server instances.

Retry logic treats any error matching a general pattern, like mentioning "503" or "high demand", as temporary and worth retrying. It doesn't tell apart a genuine temporary overload from a quota or billing limit, which wouldn't be fixed by waiting a few seconds.

The concurrency cap only limits how many requests this app sends out at once. It cannot protect against a rate limit set by Gemini on my account itself. I confirmed this directly when testing with 5 uploads at once, covered in Section 6.

Left out on purpose, matching the brief: no editing of extracted notes, no sharing, no landing page, no account features beyond email and password.

Left out because of time, not because it was out of scope: I did not test a large number of simultaneous uploads beyond a small manual check, so the concurrency cap holding up under real load is not stress tested at scale.

## Section 8: If I Built This Again

The one thing I would do differently is check which models my API key actually had access to before writing any code against a specific model name. I lost real time chasing two different 404 errors because I picked a model name without confirming it against my own account first, when one request to Google's models list would have told me right away.
