import type { NextConfig } from 'next';

type WebpackRule = {
  oneOf?: WebpackRule[];
  test?: RegExp;
  use?: unknown;
};

function findCssModuleRule(rules: WebpackRule[]): WebpackRule | undefined {
  for (const rule of rules) {
    if (
      rule.test instanceof RegExp
      && rule.test.test('file.module.css')
      && Array.isArray(rule.use)
    ) {
      return rule;
    }

    if (Array.isArray(rule.oneOf)) {
      const nestedRule = findCssModuleRule(rule.oneOf);
      if (nestedRule) {
        return nestedRule;
      }
    }
  }

  return undefined;
}

// standalone 会把生产运行需要的服务端代码打包到 .next/standalone，方便用 server.js 或 PM2 部署。
const nextConfig: NextConfig = {
  output: 'standalone',
  webpack(config) {
    const oneOfRule = config.module.rules.find(
      (rule: WebpackRule) => Array.isArray(rule.oneOf),
    );

    if (!oneOfRule?.oneOf) {
      return config;
    }

    const cssModuleRule = findCssModuleRule(oneOfRule.oneOf);
    if (!cssModuleRule || !Array.isArray(cssModuleRule.use)) {
      return config;
    }

    oneOfRule.oneOf.unshift({
      ...cssModuleRule,
      test: /\.module\.less$/,
      use: [
        ...cssModuleRule.use,
        {
          loader: 'less-loader',
          options: {
            lessOptions: {
              javascriptEnabled: true,
            },
          },
        },
      ],
    });

    return config;
  },
};

export default nextConfig;
