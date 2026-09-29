We are creating a project based on Project.md file in this directory. File is long.
Projects.md file might specify Prisma for ORM. but know that we are using TypeORM.
Use npm only.
This repo has two independent projects at root: backend/ and frontend/.
Do not create a root npm workspace, apps/, packages/, or shared package unless explicitly requested.
Keep backend config inside backend/ and frontend config inside frontend/.
Keep a single .gitignore at the repository root because the root is the Git repo.
Use npm even if older project notes mention another package manager.
Use NestJS for the backend, not Express.
Use SendGrid for email delivery; do not build new email work around Nodemailer/SMTP unless explicitly asked.
