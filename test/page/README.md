# preproccess-filter

Customize rendering on the server.

## Install
>$ npm install preproccess-filter --save

## How to use

### server index.js
``` javascript

	var preproccess = require('preproccess-filter');
	var content = preproccess.render("/", {
		content: 'content',
		dataList: [
			{
				id:1,
				content: 1
			},
			{
				id:2,
				content: 2
			},
			{
				id:3,
				content: 3
			}
		]
	});
	res.end(content);
```

### client test.html
``` html

	{vinson:include="./header.html" /}
	<h1>{vinson:field.content /}</h1>
	<ul>
		{vinson:data from="dataList" parser="dataList"}
			{if "[data:content /]" = "2" then}
				<li>第二个</li>
			{else}
				<li>[data:content /]</li>
			{end if}
		{/vinson:data}
	</ul>
```


## License
The MIT License(http://opensource.org/licenses/MIT)