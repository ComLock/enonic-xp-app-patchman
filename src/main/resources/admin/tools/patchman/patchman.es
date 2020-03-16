import {toStr} from '/lib/util';
import {forceArray} from '/lib/util/data';
import {list as listRepos} from '/lib/xp/repo';
import {
	connect as singleRepoConnect,
	multiRepoConnect
} from '/lib/xp/node';


export function get(request) {
	//log.info(`request:${toStr(request)}`);

	const {
		//params: requestParams,
		params: {
			repoIds: repoIdsParam = [],
			count: countParam = '0',
			start: startParam = '0',
			query: queryParam = '',
			fields: fieldsParam = []
		}
	} = request;
	//log.info(`requestParams:${toStr(requestParams)}`);

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
			start: intStart
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
			const node = singleRepoConnection.get(nodeId); // Get once
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

	const body = `<html>
	<body>
		<h1>PatchMan</h1>
		<form>
			<table>
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
					<td><select name="fields" multiple size="${seenTopFields.length || 1}">${fieldOptionsHtml}</select></td>
				</tr>

			</table>
			<input type="submit"/>
		</form>

		<h2>Query params</h2>
		<pre>${toStr(queryParams)}</pre>

		<h2>Result</h2>
		<pre>${toStr(result)}</pre>
	</body>
</html>`;
	return {
		body
	};
} // get
