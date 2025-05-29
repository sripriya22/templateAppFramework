module.exports = (api) => {
  const isTest = api.env('test');
  
  const presets = [
    ['@babel/preset-env', {
      targets: isTest ? { node: 'current' } : { esmodules: true },
      modules: isTest ? 'commonjs' : false,
      useBuiltIns: 'usage',
      corejs: 3,
      shippedProposals: true,
      bugfixes: true
    }]
  ];

  const plugins = [
    ['@babel/plugin-transform-runtime', {
      useESModules: !isTest,
      regenerator: true,
      corejs: 3
    }]
  ];

  return {
    presets,
    plugins,
    // This helps with debugging
    sourceMaps: 'inline',
    retainLines: true
  };
};
