//import {toStr} from '/lib/util';
import {forceArray} from '/lib/util/data';
import {list as listRepos} from '/lib/xp/repo';


export function get(request) {
	//log.info(`request:${toStr(request)}`);

	const {
		//params: requestParams,
		params: {
			repoIds: repoIdsParam = []
		}
	} = request;
	//log.info(`requestParams:${toStr(requestParams)}`);

	const selectedRepoIds = forceArray(repoIdsParam);
	//log.info(`selectedRepoIds:${toStr(selectedRepoIds)}`);

	const repoList = listRepos();
	//log.info(`repoList:${toStr(repoList)}`);

	const allRepoIds = repoList.map(({id}) => id);
	//log.info(`allRepoIds:${toStr(allRepoIds)}`);

	const repoOptionsHtml = allRepoIds.map((id) => `<option${selectedRepoIds.includes(id) ? ' selected' : ''} value="${id}">${id}</option>`).join('');
	//log.info(`repoOptionsHtml:${toStr(repoOptionsHtml)}`);

	const body = `<html>
	<body>
		<h1>PatchMan</h1>
		<form>
			<select name="repoIds" multiple size="${repoList.length || 1}">${repoOptionsHtml}</select>
			<input type="submit">
		</form>
	</body>
</html>`;
	return {
		body
	};
} // get
