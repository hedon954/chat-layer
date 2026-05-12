.PHONY: install dev build typecheck lint test ci clean

install:
	npm install

dev:
	npm run dev

build:
	npm run build

typecheck:
	npm run typecheck

lint:
	npm run lint

test:
	npm run test

ci:
	npm run ci

clean:
	npm run clean
