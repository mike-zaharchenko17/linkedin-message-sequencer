/**
 * Minimal LinkedIn profile stub generator for local testing.
 * Returns an object shaped like a row from `prospects` so it can be
 * inserted into the DB or used as a mock in unit tests.
 */

import { ProspectStub } from "../../types/types.js";

export function generateLinkedInProfileStub(
	linkedin_url: string,
	overrides: Partial<ProspectStub> = {}
): ProspectStub {
	const defaultProfile: ProspectStub = {
		linkedin_url,
		fname: 'Alex',
		middle_initial: null,
		lname: 'Morgan',
		headline: 'Product Manager | B2B SaaS',
		profile_data: {
			location: 'San Francisco, CA',
			current_company: {
				name: 'Acme Co',
				title: 'Product Manager',
				start_date: '2021-06',
			},
			experience: [
				{ company: 'Acme Co', title: 'Product Manager', from: '2021-06', to: null },
				{ company: 'OtherCorp', title: 'Associate PM', from: '2019-01', to: '2021-05' },
			],
			education: [
				{ school: 'State University', degree: 'BS', field: 'Computer Science', grad_year: 2018 },
			],
			skills: ['product management', 'roadmapping', 'user research'],
			summary:
				'Product leader focused on building data-informed experiences that scale.',
		},
	};

	return {
		...defaultProfile,
		...overrides,
	};
}

export default generateLinkedInProfileStub;

