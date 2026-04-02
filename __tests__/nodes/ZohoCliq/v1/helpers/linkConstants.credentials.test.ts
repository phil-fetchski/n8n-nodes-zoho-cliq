import {
	CREDENTIALS_SETUP_GUIDE_LINK,
	GITHUB_REPO_BASE_URL,
} from '../../../../../nodes/ZohoCliq/v1/helpers/linkConstants';

describe('ZohoCliq - linkConstants credentials guide link', () => {
	it('should build the credentials setup guide link from the GitHub repo base URL', () => {
		expect(CREDENTIALS_SETUP_GUIDE_LINK).toBe(
			`${GITHUB_REPO_BASE_URL}/blob/main/documentation/CREDENTIALS.md`,
		);
	});
});
