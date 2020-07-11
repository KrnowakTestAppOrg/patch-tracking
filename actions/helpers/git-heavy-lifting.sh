#!/bin/bash

# redirect stderr to stdout
exec 2>&1

set -euo pipefail
set -x

github_token="${1}"
owner="${2}"
repo="${3}"
branch="${4}"
bot_branch="${5}"
bot_email="${6}"
bot_git_name="${7}"
shift 7

workdir="$(dirname "${PWD}")/bot-work-dir"
credsfile="${workdir}/creds"

mkdir -p "${workdir}"

if [[ ! -e "${credsfile}" ]]; then
    git config --global credential.helper "store --file=${credsfile}"
    echo "https://${github_token}:x-oauth-basic@github.com" >"${credsfile}"
    git config --global user.email "${bot_email}"
    git config --global user.name "${bot_git_name}"
fi

repodir="${workdir}/repos/${owner}/${repo}"

if [[ ! -d "${repodir}" ]]; then
    mkdir -p "$(dirname "${repodir}")"
    git clone "https://github.com/${owner}/${repo}.git" "${repodir}"
else
    git -C "${repodir}" fetch origin -pPt
fi

cd "${repodir}"

# get rid of changed or untracked files
git reset --hard HEAD
git clean -ffdx
# checkout the target branch and update it
git checkout "${branch}"
git reset --hard "origin/${branch}"
# create a new branch for cherry picking
git checkout -b "${bot_branch}"
for commit in "${@}"; do
    if ! git cherry-pick "${commit}"; then
        git cherry-pick --abort
        git reset --hard HEAD
        git clean -ffdx
        git checkout "${branch}"
        git branch -D "${bot_branch}"
        exit 1
    fi
done
# push and clean up
git push origin "${bot_branch}"
git checkout "${branch}"
git branch -D "${bot_branch}"
