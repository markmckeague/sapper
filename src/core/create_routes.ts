import * as path from 'path';
import glob from 'glob';
import { locations } from '../config';
import { Route } from '../interfaces';

export default function create_routes({
	files
} = {
	files: glob.sync('**/*.*', {
		cwd: locations.routes(),
		dot: true,
		nodir: true
	})
}) {
	const all_routes = files
		.filter((file: string) => !/(^|\/|\\)(_(?!error\.html)|\.(?!well-known))/.test(file))
		.map((file: string) => {
			if (/]\[/.test(file)) {
				throw new Error(`Invalid route ${file} — parameters must be separated`);
			}

			if (file === '4xx.html' || file === '5xx.html') {
				throw new Error('As of Sapper 0.14, 4xx.html and 5xx.html should be replaced with _error.html');
			}

			const base = file.replace(/\.[^/.]+$/, '');
			const parts = base.split('/'); // glob output is always posix-style
			if (/^index(\..+)?/.test(parts[parts.length - 1])) {
				const part = parts.pop();
				if (parts.length > 0) parts[parts.length - 1] += part.slice(5);
			}

			const id = (
				parts.join('_').replace(/[[\]]/g, '$').replace(/^\d/, '_$&').replace(/[^a-zA-Z0-9_$]/g, '_')
			) || '_';

			const type = file.endsWith('.html') ? 'page' : 'route';

			const params: string[] = [];
			const match_patterns: Record<string, string> = {};
			const param_pattern = /\[([^\(\]]+)(?:\((.+?)\))?\]/g;

			let match;
			while (match = param_pattern.exec(base)) {
				params.push(match[1]);
				if (typeof match[2] !== 'undefined') {
					if (/[\(\)\?\:]/.exec(match[2])) {
						throw new Error('Sapper does not allow (, ), ? or : in RegExp routes yet');
					}
					// Make a map of the regexp patterns
					match_patterns[match[1]] = `(${match[2]}?)`;
				}
			}

			// TODO can we do all this with sub-parts? or does
			// nesting make that impossible?
			let pattern_string = '';
			let i = parts.length;
			let nested = true;
			while (i--) {
				const part = encodeURI(parts[i].normalize()).replace(/\?/g, '%3F').replace(/#/g, '%23').replace(/%5B/g, '[').replace(/%5D/g, ']');
				const dynamic = ~part.indexOf('[');

				if (dynamic) {
					// Get keys from part and replace with stored match patterns
					const keys = part.replace(/\(.*?\)/, '').split(/[\[\]]/).filter((x, i) => { if (i % 2) return x });
					let matcher = part;
					keys.forEach(k => {
						const key_pattern = new RegExp('\\[' + k + '(?:\\((.+?)\\))?\\]');
						matcher = matcher.replace(key_pattern, match_patterns[k] || `([^/]+?)`);
					})
					pattern_string = (nested && type === 'page') ? `(?:\\/${matcher}${pattern_string})?` : `\\/${matcher}${pattern_string}`;
				} else {
					nested = false;
					pattern_string = `\\/${part}${pattern_string}`;
				}
			}

			const pattern = new RegExp(`^${pattern_string}\\/?$`);

			const test = (url: string) => pattern.test(url);

			const exec = (url: string) => {
				const match = pattern.exec(url);
				if (!match) return;

				const result: Record<string, string> = {};
				params.forEach((param, i) => {
					result[param] = match[i + 1];
				});

				return result;
			};

			return {
				id,
				base,
				type,
				file,
				pattern,
				test,
				exec,
				parts,
				params
			};
		});

	const pages = all_routes
		.filter(r => r.type === 'page')
		.sort(comparator);

	const server_routes = all_routes
		.filter(r => r.type === 'route')
		.sort(comparator);

	return { pages, server_routes };
}

function comparator(a, b) {
	if (a.parts[0] === '_error') return -1;
	if (b.parts[0] === '_error') return 1;

	const max = Math.max(a.parts.length, b.parts.length);

	for (let i = 0; i < max; i += 1) {
		const a_part = a.parts[i];
		const b_part = b.parts[i];

		if (!a_part) return -1;
		if (!b_part) return 1;

		const a_sub_parts = get_sub_parts(a_part);
		const b_sub_parts = get_sub_parts(b_part);
		const max = Math.max(a_sub_parts.length, b_sub_parts.length);

		for (let i = 0; i < max; i += 1) {
			const a_sub_part = a_sub_parts[i];
			const b_sub_part = b_sub_parts[i];

			if (!a_sub_part) return 1; // b is more specific, so goes first
			if (!b_sub_part) return -1;

			if (a_sub_part.dynamic !== b_sub_part.dynamic) {
				return a_sub_part.dynamic ? 1 : -1;
			}

			if (!a_sub_part.dynamic && a_sub_part.content !== b_sub_part.content) {
				return (
					(b_sub_part.content.length - a_sub_part.content.length) ||
					(a_sub_part.content < b_sub_part.content ? -1 : 1)
				);
			}

			// If both parts dynamic, check for regexp patterns
			if (a_sub_part.dynamic && b_sub_part.dynamic) {
				const regexp_pattern = /\((.*?)\)/;
				const a_match = regexp_pattern.exec(a_sub_part.content);
				const b_match = regexp_pattern.exec(b_sub_part.content);

				if (!a_match && b_match) {
					return 1; // No regexp, so less specific than b
				}
				if (!b_match && a_match) {
					return -1;
				}
				if (a_match && b_match && a_match[1] !== b_match[1]) {
					return b_match[1].length - a_match[1].length;
				}
			}
		}
	}

	throw new Error(`The ${a.base} and ${b.base} routes clash`);
}

function get_sub_parts(part: string) {
	return part.split(/\[(.+)\]/)
		.map((content, i) => {
			if (!content) return null;
			return {
				content,
				dynamic: i % 2 === 1
			};
		})
		.filter(Boolean);
}