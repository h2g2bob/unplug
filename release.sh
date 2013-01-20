#!/bin/bash

echo "What version?"
read version

# Mozilla addons require a version number
firefox_max="19.*"
seamonkey_max="2.9.*"

revision="$( date +"%04Y%02m%02d%02H%02M" )";

echo "Version ${version} release ${revision} for firefox <= ${firefox_max} and seamonkey <= ${seamonkey_max} [y/N]?"
read yn
[ "y" = "${yn}" ] || exit

function set_version {
	version="$1"
	revision="$2"
	beta="$3"
	sed -i -r "s/version\s*:\s*[0-9\.]+,/version : ${version},/" unplug@compunach/chrome/content/common.js
	sed -i -r "s/revision\s*:\s*[0-9]+,/version : ${revision},/" unplug@compunach/chrome/content/common.js
	sed -i -r "s/em:version\s*=\s*\"[0-9\.]+\"/em:version=\"${version}${beta}\"/" unplug@compunach/install.rdf
}

function set_firefox_max {
	firefox_max="$1"
	seamonkey_max="$2"
	sed -i -r "s/(<em:maxVersion>)\*(<\/em:maxVersion>.*firefox)/\1${firefox_max}\2/" unplug@compunach/install.rdf
	sed -i -r "s/(<em:maxVersion>)\*(<\/em:maxVersion>.*seamonkey)/\1${seamonkey_max}\2/" unplug@compunach/install.rdf
}

function check_locales {
	grep -h -o -E 'ENTITY [^ ]+' -R  "unplug@compunach/chrome/locale/en-US/" | sort -u > /tmp/a;
	for loc in "unplug@compunach/chrome/locale/*"; do
		grep -h -o -E 'ENTITY [^ ]+' -R  "${loc}" | sort -u > "$TEMP/b";
		if ! diff "$TEMP/a" "$TEMP/b"; then
			echo "Locale ${loc} conflicts";
			exit;
		fi;
	done
}

[ "0" = "$( git diff | wc -l )" ] || {
	git diff
	exit
}

for branch in master release amo; do
	echo "$branch:"
	git log --pretty=oneline -n 1 "$branch"
done

# make sure I remember the password before making any changes!
git tag "test-${version}" -m "This is only a test: delete me" -s -u unplug@dbatley.com || exit
git tag -d "test-${version}" || exit

echo "Preparing release branch"
git checkout release || exit
git merge master || exit
set_version "$version" "$revision" "" || exit
git add --update || exit

echo "Releasing standard (website) version"
git commit -m "Release ${version}" || exit
git tag "${version}" -m "Release ${version}" -s -u unplug@dbatley.com || exit

echo "Building official archive"
git archive "${version}:unplug@compunach" --format=zip --output="unplug-${version}.xpi" || exit
git archive "${version}" --format=tar --output="unplug-${version}.tar" --prefix="unplug-${version}/" || exit

echo "Building AMO archive"
git checkout amo
git merge master
set_version "$version" "$revision" "" || exit
set_firefox_max "${firefox_max}" "${seamonkey_max}" || exit
git add unplug@compunach/install.rdf || exit
git commit -m "AMO ${version}" || exit
git archive "amo:unplug@compunach" --format=zip --output="unplug-${version}-amo.xpi" || exit

echo "Building AMO beta archive"
set_version "$version" "$revision" "beta" || exit
set_firefox_max "${firefox_max}" "${seamonkey_max}" || exit
git add unplug@compunach/install.rdf || exit
git commit -m "AMO ${version}beta" || exit
git archive "amo:unplug@compunach" --format=zip --output="unplug-${version}-amo-beta.xpi" || exit

gpg -u unplug@dbatley.com --armour --detach-sign "unplug-${version}.xpi"
gpg -u unplug@dbatley.com --armour --detach-sign "unplug-${version}-amo.xpi"
gpg -u unplug@dbatley.com --armour --detach-sign "unplug-${version}-amo-beta.xpi"

git reset --hard release
git checkout master
echo "Done!"
echo ""
echo "Now do:"
echo "  git push www"
echo "  git push www ${version}"
echo "  scp into .../releases/"
