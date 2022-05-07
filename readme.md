# gulp-rev-cto

[gulp-rev-cto](https://www.npmjs.com/package/gulp-rev-cto) 是基于 [gulp-rev](https://www.npmjs.com/package/gulp-rev) & [gulp-rev-collector](https://www.npmjs.com/package/gulp-rev-collector)改造，将 hash 值置于文件后，避免生成多个的文件，同时封装 rev-collector， 无需安装两个依赖。

## Install

```
$ npm install --save-dev gulp-rev-cto
```

## Usage

```js
const gulp = require('gulp');
const rev = require('gulp-rev-cto');
const { revCollector } = rev;
gulp.task('default', () =>
    gulp.src('src/*.css')
    .pipe(rev())
    .pipe(rev.manifest({ merge: true }))
        .pipe(gulp.dest('dist'))
);
// or
gulp.task('default', () =>
    gulp.src('src/*.html')
    .pipe(revCollector({
        replaceReved: true,
    }))
        .pipe(gulp.dest('dist'))
);

// 新增manifest【resourceUrl】参数 生成的json中的value值会拼接该字段，用于全局替换
gulp.task('default', () =>
    gulp.src('src/*.css')
    .pipe(rev())
    .pipe(rev.manifest({
        resourceUrl:'//cnd.xxx.com/cdn/'
    }))
        .pipe(gulp.dest('dist'))
);

//---->生成的文件
{
  "images/default/icon/A.png": "//cnd.xxx.com/cdn/images/default/icon/A.png?v=b8acf03fca",
}

```

## API

参考[gulp-rev](https://www.npmjs.com/package/gulp-rev) & [gulp-rev-collector](https://www.npmjs.com/package/gulp-rev-collector)
