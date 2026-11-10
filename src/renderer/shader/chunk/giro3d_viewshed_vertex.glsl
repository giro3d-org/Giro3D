vec4 viewshed_worldPos = modelMatrix * vec4(transformed, 1.0);
viewshed_vVisWorld = viewshed_worldPos.xyz;
