<div class="panel panel-default ns-custom-fields-panel">
    <div class="panel-body text-center">
        <form method="GET" action="linkmc/callback">
            <h2>API Key</h2>
            <input class="form-control" type="text" name="apikey" id="inputcode" placeholder="API Key" value="{current_key}">
            <br>
            <h2>Donor Group Name</h2>
            <input class="form-control" type="text" name="donor" id="inputcode" placeholder="Donor Group Name" value="{current_donor}">
            <br>
            <a id="goBack" href="../" class="btn btn-primary">Go Back</a>
            <button id="submitBtn" type="submit" href="#" class="btn btn-primary">Set Fields</a>
        </form>
    </div>
</div>