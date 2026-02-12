# AWS Elastic Beanstalk Deployment Guide

This guide walks you through deploying the Rewrd API using AWS CodePipeline, CodeBuild, and Elastic Beanstalk.

## Prerequisites
- AWS Account
- GitHub Repository (with this code pushed)

## Step 1: Create RDS Database (Postgres)
1. Go to **RDS Console** -> **Create database**.
2. **Engine**: PostgreSQL (v14+ recommended).
3. **Template**: Free tier (if creating a test env) or Production.
4. **Settings**:
   - DB Instance Identifier: `rewrd-db`
   - Master username: `postgres`
   - Master password: `your_secure_password` (Save this!).
5. **Connectivity**:
   - Public access: **No** (Secure) or **Yes** (if you need to connect from local GUI).
   - VPC Security Group: Create new (e.g., `rewrd-db-sg`).
6. **Create**. Wait for status "Available".
7. **Note Endpoint**: e.g., `rewrd-db.cx...us-east-1.rds.amazonaws.com`.

## Step 2: Create Elastic Beanstalk Environment
1. Go to **Elastic Beanstalk Console** -> **Create Application**.
2. **Name**: `rewrd-api`.
3. **Platform**: Node.js (Branch: Node.js 18 running on 64bit Amazon Linux 2023).
4. **Application Code**: Sample application (we will overwrite it with Pipeline).
5. **Configure more options**:
   - **Environment properties**: Add your Env Vars here!
     - `node_env`: `production`
     - `PORT`: `8080` (EB default)
     - `DB_HOST`: `[RDS Endpoint]`
     - `DB_USER`: `postgres`
     - `DB_PASSWORD`: `[Your Password]`
     - `DB_NAME`: `rewrd_db` (Default Postgres DB name)
     - `SWAGGER_ROUTE_SECRET`: `your_secret`
     - `LOG_LEVEL`: `info`
   - **Database**: Do NOT enable the integrated database option (managed RDS is better).
6. **Create Environment**. This takes ~5-10 mins.

## Step 3: Create CodePipeline
1. Go to **CodePipeline Console** -> **Create pipeline**.
2. **Pipeline Name**: `rewrd-api-pipeline`.
3. **Source Provider**: GitHub (Version 2).
   - Connect to GitHub.
   - Select Repository: `rewrd-api`.
   - Branch: `main`.
4. **Build Provider**: AWS CodeBuild.
   - **Create Project**:
     - Name: `rewrd-api-build`
     - Environment: Managed Image -> Ubuntu -> Standard -> 7.0 (or latest).
     - Buildspec: Use a buildspec file (`buildspec.yml`).
5. **Deploy Provider**: AWS Elastic Beanstalk.
   - Application name: `rewrd-api`.
   - Environment name: `Rewrdapi-env` (select the one you created).
6. **Create Pipeline**.

## Troubleshooting
- **Logs**: In EB Console -> Logs -> Request Logs (Last 100 lines) to see why startup failed.
- **Migration Fails**: Ensure Security Group allows traffic from EB instance to RDS (port 5432).
  - Go to EC2 -> Security Groups.
  - Find `rewrd-db-sg`.
  - Edit Inbound Rules: Allow TCP 5432 from `Anywhere` (0.0.0.0/0) (Test only) or from the EB Security Group ID (Prod).

- **CodeBuild Access Denied (`codebuild:StartBuild`)**:
  - The CodePipeline Service Role needs permission to trigger your CodeBuild project.
  1. Go to **IAM Console** -> **Roles**.
  2. Search for the role mentioned in the error: `AWSCodePipelineServiceRole-eu-north-1-rewrd` (or similar).
  3. Click **Add permissions** -> **Create inline policy**.
  4. Select **CodeBuild**.
  5. Action: `StartBuild`, `BatchGetBuilds`.
  6. Resources: Select the ARN of your build project (`...:project/rewrd-build-dev`).
  7. Save policy as `CodeBuildAccess`.
  8. Retry the Pipeline.

- **Deployment Failed (`Engine execution has encountered an error`)**:
  - This typically means the `container_commands` (migrations) failed.
  - **Check 1: Security Group**: Ensure EB instance can reach RDS on port 5432.
  - **Check 2: Env Vars**: Ensure `DB_HOST`, `DB_USER`, etc., are correct in Elastic Beanstalk Configuration.
  - **Check 3: Logs**: Go to EB Console -> Logs -> Request Instance Logs (Last 100 lines) -> Look for `eb-engine.log` or `cfn-init.log` to see the migration error.
  - **Workaround**: We added `ignoreErrors: true` to `.ebextensions/02_migration.config` to allow deployment to succeed even if migration fails. You can then SSH into the instance or check logs to debug connectivity.
