// Node modules
import diff from 'deep-diff';
import beautify from 'js-beautify';
//import serialize from 'serialize-javascript';
//import traverse from 'traverse';

// XP libraries
import {toStr} from '/lib/util';
import {forceArray} from '/lib/util/data';
import {get as getContext} from '/lib/xp/context';
import {list as listRepos} from '/lib/xp/repo';
import {
	connect as singleRepoConnect,
	multiRepoConnect
} from '/lib/xp/node';
import {assetUrl} from '/lib/xp/portal';


const DEFAULT_FIELDS = [
	'_id',
	'_path',
	'_name',
	'createdTime',
	'modifiedTime',
	'displayName'
];


const DEFAULT_FILTERS_OBJ = {
	boolean: {
		must: [
			{
				exists: {
					field: '_name'
				}
			}
		]
	}
};
const DEFAULT_FILTERS_STR = toStr(DEFAULT_FILTERS_OBJ);


const DEFAULT_AGGREGATIONS_OBJ = {
	/*repo: {
		terms: {
			field: 'repoId',
			order: '_count desc',
			size: 100
		}
	}, WARNING: Not currently possible */
	type: {
		terms: {
			field: 'type',
			order: '_count desc',
			size: 100
		}
	}
};
const DEFAULT_AGGREGATIONS_STR = toStr(DEFAULT_AGGREGATIONS_OBJ);


/* eslint-disable no-param-reassign */
/* eslint-disable no-self-assign */
/* eslint-disable no-underscore-dangle */
/*const TOUCH_FN = (node) => {
	node._id = 'RENAMED'; // This should fail miserably since modify should not be allowed to give a new id...
	//node._name = node._name;
	//node._path = node._path;
	return node;
};*/
/* eslint-enable */

const JS_STR = `
	node._id = 'ID_CHANGED';
	node._name = 'NAME_CHANGED';
`;

/*const TOUCH_FN_SERIALIZED = serialize(JS_STR, {
	space: 4 // Doesn't work?
});*/
//log.info(`TOUCH_FN_SERIALIZED:${toStr(TOUCH_FN_SERIALIZED)}`);

const TOUCH_FN_BEAUTIFIED = beautify(JS_STR);
//log.info(`TOUCH_FN_BEAUTIFIED:${TOUCH_FN_BEAUTIFIED}`);


export function get(request) {
	const FAVICON_HREF = assetUrl({
		path: 'images/svg/patchman.svg'
	});
	//log.info(`request:${toStr(request)}`);

	const context = getContext();
	//log.info(`context:${toStr(context)}`);

	const {
		//params: requestParams,
		params: {
			repoIds: repoIdsParam = [],
			count: countParam = '1',
			start: startParam = '0',
			query: queryParam = "_name LIKE '*'",
			fields: fieldsParam = DEFAULT_FIELDS,
			sort: sortParam = '_score DESC',
			explain: explainParam, // 'on' = true
			filters: filtersParam = DEFAULT_FILTERS_STR, // JSON
			aggregations: aggregationsParam = DEFAULT_AGGREGATIONS_STR, // JSON
			editorFn: modifyParam = TOUCH_FN_BEAUTIFIED,
			modifyInReposWithIds: modifyInReposWithIdsParam = JSON.stringify({}), // JSON
			action: actionParam = 'query'
		}
	} = request;
	//log.info(`requestParams:${toStr(requestParams)}`);

	const modifyInReposWithIds = actionParam === 'modify' ? JSON.parse(modifyInReposWithIdsParam) : {};
	//log.info(`modifyInReposWithIds:${toStr(modifyInReposWithIds)}`);

	//log.info(`modifyParam:${modifyParam}`);

	//log.info(`filtersParam:${toStr(filtersParam)}`);

	const filtersObj = JSON.parse(filtersParam); // Ignores whitespace :)
	//log.info(`filtersObj:${toStr(filtersObj)}`);

	const aggregationsObj = JSON.parse(aggregationsParam); // Ignores whitespace :)

	//log.info(`explainParam:${toStr(explainParam)}`);
	const boolExplain = explainParam === 'on';

	const selectedRepoIds = forceArray(repoIdsParam);
	//log.info(`selectedRepoIds:${toStr(selectedRepoIds)}`);

	const selectedFields = forceArray(fieldsParam);

	const intCount = parseInt(countParam, 10);
	const intStart = parseInt(startParam, 10);

	const repoList = listRepos();
	//log.info(`repoList:${toStr(repoList)}`);

	const allRepoIds = repoList.map(({id}) => id);
	//log.info(`allRepoIds:${toStr(allRepoIds)}`);

	const repoOptionsHtml = allRepoIds.map((id) => `<option${selectedRepoIds.includes(id) ? ' selected' : ''} value="${id}">${id}</option>`).join('');
	//log.info(`repoOptionsHtml:${toStr(repoOptionsHtml)}`);

	const sources = selectedRepoIds.map((repoId) => ({
		repoId,
		branch: 'master',
		principals: ['role:system.admin']
	}));
	//log.info(`sources:${toStr(sources)}`);

	const multirepoConnection = multiRepoConnect({sources});
	let queryParams = {};
	let result = {
		total: 0
	};
	const seenTopFields = [];

	if (multirepoConnection) {
		queryParams = {
			count: intCount,
			query: queryParam,
			start: intStart,
			sort: sortParam,
			explain: boolExplain,
			filters: filtersObj,
			aggregations: aggregationsObj
		};
		//log.info(`queryParams:${toStr(queryParams)}`);

		result = multirepoConnection.query(queryParams);
		result.hits = result.hits.map(({
			id: nodeId, score, repoId, branch
		}) => {
			const singleRepoConnection = singleRepoConnect({
				repoId,
				branch
			});
			if (!modifyInReposWithIds[repoId]) {
				modifyInReposWithIds[repoId] = [];
			}
			//log.info(`modifyInReposWithIds:${toStr(modifyInReposWithIds)}`);

			const node = singleRepoConnection.get(nodeId); // Get once
			if (!modifyInReposWithIds[repoId].includes(nodeId)) {
				modifyInReposWithIds[repoId].push(nodeId);
			}
			//log.info(`modifyInReposWithIds:${toStr(modifyInReposWithIds)}`);

			/*const paths = traverse(node).paths();
			log.info(`paths:${toStr(paths)}`);*/

			/*traverse(node).forEach(function(value) { // eslint-disable-line
				const key = this.key; // eslint-disable-line prefer-destructuring
				if (!key.match(/^[0-9]+$/)) { // Not number
					// continue
				}
				log.info(`key:${toStr(key)}`);
			});*/

			Object.keys(node).forEach((key) => {
				if (!seenTopFields.includes(key)) {
					seenTopFields.push(key);
				}
			});
			return {
				nodeId, score, repoId, branch, node
			};
		});
	}
	//log.info(`modifyInReposWithIds:${toStr(modifyInReposWithIds)}`);

	if (selectedFields.length) {
		result.hits = result.hits.map(({
			nodeId, score, repoId, branch, node
		}) => {
			const filteredNode = {};
			selectedFields.forEach((selectedField) => {
				filteredNode[selectedField] = node[selectedField];
			});
			return {
				nodeId, score, repoId, branch, node: filteredNode
			};
		});
	}

	const fieldOptionsHtml = seenTopFields.map((id) => `<option${selectedFields.includes(id) ? ' selected' : ''} value="${id}">${id}</option>`).join('');
	//log.info(`result:${toStr(result)}`);

	const filtersText = toStr(filtersObj);
	//log.info(`filtersText:${filtersText}`);

	const filtersArray = filtersText.split(/\r?\n/);
	//log.info(`filtersArray:${toStr(filtersArray)}`);

	const aggregationsText = toStr(aggregationsObj);
	const aggregationsArray = aggregationsText.split(/\r?\n/);

	const modifyInReposWithIdsText = toStr(modifyInReposWithIds);
	const modifyInReposWithIdsLines = modifyInReposWithIdsText.split(/\r?\n/);

	const modifyText = modifyParam;
	const modifyLines = modifyText.split(/\r?\n/);

	const modifiedNodes = {};
	if (actionParam === 'modify') {
		const evalContext = {};
		// eslint-disable-next-line no-eval
		const fn = eval(`function(node) {
			${modifyParam}
			return node;
		}`, evalContext);
		/*const testNode = {
			_id: 'id',
			_name: 'name'
		};
		const changedNode = fn(testNode);
		log.info(`changedNode:${toStr(changedNode)}`);*/

		Object.keys(modifyInReposWithIds).forEach((repoId) => {
			const singleRepoConnection = singleRepoConnect({
				repoId,
				branch: 'master'
			});
			modifyInReposWithIds[repoId].forEach((nodeId) => {
				const currentNode = singleRepoConnection.get(nodeId);
				const modifiedNode = singleRepoConnection.modify({
					key: nodeId,
					editor: fn
				});
				//modifiedNodes[nodeId] = modifiedNode;
				modifiedNodes[nodeId] = diff(currentNode, modifiedNode);
			}); // each node in repo
		}); // each repo
	} // if modify
	//log.info(`modifiedNodes:${toStr(modifiedNodes)}`);

	const body = `<html>
	<head>
		<title>PatchMan</title>
		<link rel="icon" href="${FAVICON_HREF}">

		<style type="text/css">
			input[type=text],
			textarea {
				width: 100%;
			}
			th {
				white-space: nowrap;
				width: 1%;
			}
		</style>
	</head>
	<body>
		<h1><svg version="1.0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 733 733" height="37" width="37"><path d="M733 367a366 366 0 11-733 0 366 366 0 01733 0z"/><path fill="#FEDE58" d="M699 370a336 336 0 11-673 0 336 336 0 01673 0z"/><path d="M325 665c-121-21-194-115-212-233v-8l-25-1-1-18h481c6 13 10 27 12 41 14 94-37 146-114 193-44 23-92 29-141 26z"/><path fill="#871945" d="M372 647c52-6 98-28 138-62 28-25 46-56 51-87 4-20 1-57-5-70l-423-1c-2 55 39 117 74 157 31 34 72 54 116 63 11 2 38 2 49 0z"/><path fill="#F9BEDD" stroke="#F9BEDD" d="M504 590s-46 40-105 53c-66 15-114-6-114-6s14-77 93-96c76-18 126 49 126 49z"/><path d="M76 342a145 145 0 0126-153c21-20 50-23 77-18 15 4 28 12 39 23 18 17 30 40 36 67 4 20 4 41 0 60l-6 21-86 1-86-1zM378 341c-2-3-6-18-8-27-4-28 0-57 12-83 15-30 41-52 72-60 29-7 57 0 82 15 26 17 45 49 50 82a138 138 0 01-8 74l-100 1c-93 0-99 0-100-2z"/><path fill="#FFF" d="M237 264c-8-37-24-73-66-77h-20c-42 4-58 40-66 77-1 6-2 15-1 24-1 15 1 31 4 35h2a1309 1309 0 00144 0c3-4 5-20 4-35 1-9 0-18-1-24zM564 323c4-5 6-39 3-55-6-24-15-48-34-61-6-6-14-10-23-13l-8-3c-51-17-105 20-115 80-3 15 0 43 3 53h68a3273 3273 0 00106-1z"/><circle cx="114" cy="294" r="40"/><circle cx="416" cy="294" r="40"/><path fill="none" stroke="#000" stroke-width="15" d="M158 117l148 86M300 202l193-78"/></svg> PatchMan</h1>

		<details>
			<summary>Context</summary>
			<pre>${toStr(context)}</pre>
		</details>

		<form enctype="application/x-www-form-urlencoded" method="POST" style="margin-bottom: 0;">
			<details open>
				<summary>Query</summary>
				<table style="width: 100%">
					<tbody>
						<tr><th colspan="2"></th></tr>
						<tr>
							<th><label for="repoIds">Repositories</label></th>
							<td><select name="repoIds" multiple size="${repoList.length || 1}">${repoOptionsHtml}</select></td>
						</tr>
						<tr>
							<th><label for="count">Count</label></th>
							<td><input name="count" type="number" value="${intCount}"/></td>
						</tr>
						<tr>
							<th><label for="start">Start</label></th>
							<td><input name="start" type="number" value="${intStart}"/></td>
						</tr>
						<tr>
							<th><label for="query">Query</label></th>
							<td><input name="query" type="text" value="${queryParam}"/></td>
						</tr>
						<tr>
							<th><label for="fields">Fields</label></th>
							<td><select name="fields" multiple size="${seenTopFields.length || 1}">${fieldOptionsHtml}</select> Must fetch at least one result to show fields.</td>
						</tr>
						<tr>
							<th><label for="sort">Sort</label></th>
							<td><input name="sort" type="text" value="${sortParam}"/></td>
						</tr>
						<tr>
							<th><label for="explain">Explain</label></th>
							<td><input${boolExplain ? ' checked' : ''} name="explain" type="checkbox"/></td>
						</tr>
						<tr>
							<th><label for="filters">Filters</label></th>
							<td><textarea name="filters" rows="${filtersArray.length}">${filtersText}</textarea></td>
						</tr>
						<tr>
							<th><label for="aggregations">Aggregations</label></th>
							<td><textarea name="aggregations" rows="${aggregationsArray.length}">${aggregationsText}</textarea></td>
						</tr>
					</table>
					<input type="submit" value="Query (or Modify)"/>
				</details>
				<details>
					<summary>Modify</summary>
						<table style="width: 100%">
							<tbody>
						<tr>
							<th><label for="action">Action</label></th>
							<td>
								<input checked id="actionQuery" name="action" type="radio" value="query"/>
								<label for="actionQuery">Query</label>

								<input name="action" id="actionModify" type="radio" value="modify"/>
								<label for="actionModify">Modify</label>
							</td>
						</tr>
						<tr>
							<th><label for="modifyInReposWithIds">Repositories and ids</label></th>
							<td><textarea name="modifyInReposWithIds" rows="${modifyInReposWithIdsLines.length}">${modifyInReposWithIdsText}</textarea></td>
						</tr>
						<tr>
							<th><label for="editorFn">Editor function</label></th>
							<td><textarea name="editorFn" rows="${modifyLines.length}">${modifyText}</textarea></td>
						</tr>
					</tbody>
				</table>
				<input type="submit" value="Query or Modify (or Query)"/>
			</details>
		</form>

		<details>
			<summary>Sources</summary>
			<pre>${toStr(sources)}</pre>
		</details>

		<details>
			<summary>Query params</summary>
			<pre>${toStr(queryParams)}</pre>
		</details>

		<h2>Result</h2>
		<pre>${toStr(result)}</pre>

		<h2>Diff</h2>
		<pre>${toStr(modifiedNodes)}</pre>
	</body>
</html>`;
	return {
		body
	};
} // get


export function post(request) {
	return get(request);
} // post

/*

<h2>Modify</h2>
<form enctype="application/x-www-form-urlencoded" method="POST">
	<table style="width: 100%">
		<tbody>
			<tr>
				<th><label for="modifyInReposWithIds">Repositories and ids</label></th>
				<td><textarea name="modifyInReposWithIds" rows="${modifyInReposWithIdsLines.length}">${modifyInReposWithIdsText}</textarea></td>
			</tr>
			<tr>
				<th><label for="editorFn">Editor function</label></th>
				<td><textarea name="editorFn" rows="${modifyLines.length}">${modifyText}</textarea></td>
			</tr>
		</tbody>
	</table>
	<input type="submit" value="!!!MODIFY!!!"/>
</form>

*/
